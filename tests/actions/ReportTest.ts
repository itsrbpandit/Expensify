/* eslint-disable @typescript-eslint/naming-convention */
import {afterEach, beforeAll, beforeEach, describe, expect, it} from '@jest/globals';
import {addSeconds, format, subMinutes} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import type {Mock} from 'jest-mock';
import Onyx from 'react-native-onyx';
import type {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as EmojiUtils from '@libs/EmojiUtils';
import HttpUtils from '@libs/HttpUtils';
import CONST from '@src/CONST';
import OnyxUpdateManager from '@src/libs/actions/OnyxUpdateManager';
import * as PersistedRequests from '@src/libs/actions/PersistedRequests';
import * as Report from '@src/libs/actions/Report';
import * as User from '@src/libs/actions/User';
import DateUtils from '@src/libs/DateUtils';
import Log from '@src/libs/Log';
import * as SequentialQueue from '@src/libs/Network/SequentialQueue';
import * as ReportUtils from '@src/libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import getIsUsingFakeTimers from '../utils/getIsUsingFakeTimers';
import PusherHelper from '../utils/PusherHelper';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForNetworkPromises from '../utils/waitForNetworkPromises';

const UTC = 'UTC';
jest.mock('@src/libs/actions/Report', () => {
    const originalModule = jest.requireActual<Report>('@src/libs/actions/Report');

    return {
        ...originalModule,
        showReportActionNotification: jest.fn(),
    };
});

jest.mock('@hooks/useScreenWrapperTransitionStatus', () => ({
    default: () => ({
        didScreenTransitionEnd: true,
    }),
}));
const originalXHR = HttpUtils.xhr;
OnyxUpdateManager();
describe('actions/Report', () => {
    beforeAll(() => {
        PusherHelper.setup();
        Onyx.init({
            keys: ONYXKEYS,
        });
    });

    beforeEach(() => {
        HttpUtils.xhr = originalXHR;
        const promise = Onyx.clear().then(jest.useRealTimers);
        if (getIsUsingFakeTimers()) {
            // flushing pending timers
            // Onyx.clear() promise is resolved in batch which happends after the current microtasks cycle
            setImmediate(jest.runOnlyPendingTimers);
        }

        return promise;
    });

    afterEach(() => {
        jest.clearAllMocks();
        PusherHelper.teardown();
    });

    it('should store a new report action in Onyx when onyxApiUpdate event is handled via Pusher', () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_USER_LOGIN = 'test@test.com';
        const REPORT_ID = '1';
        let reportActionID: string;
        const REPORT_ACTION = {
            actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
            actorAccountID: TEST_USER_ACCOUNT_ID,
            automatic: false,
            avatar: 'https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_3.png',
            message: [{type: 'COMMENT', html: 'Testing a comment', text: 'Testing a comment', translationKey: ''}],
            person: [{type: 'TEXT', style: 'strong', text: 'Test User'}],
            shouldShow: true,
        };

        let reportActions: OnyxEntry<OnyxTypes.ReportActions>;
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (val) => (reportActions = val),
        });

        // Set up Onyx with some test user data
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN)
            .then(() => {
                User.subscribeToUserEvents();
                return waitForBatchedUpdates();
            })
            .then(() => TestHelper.setPersonalDetails(TEST_USER_LOGIN, TEST_USER_ACCOUNT_ID))
            .then(() => {
                // This is a fire and forget response, but once it completes we should be able to verify that we
                // have an "optimistic" report action in Onyx.
                Report.addComment(REPORT_ID, 'Testing a comment');
                return waitForBatchedUpdates();
            })
            .then(() => {
                const resultAction: OnyxEntry<OnyxTypes.ReportAction> = Object.values(reportActions ?? {}).at(0);
                reportActionID = resultAction?.reportActionID ?? '-1';

                expect(resultAction?.message).toEqual(REPORT_ACTION.message);
                expect(resultAction?.person).toEqual(REPORT_ACTION.person);
                expect(resultAction?.pendingAction).toBeUndefined();

                // We subscribed to the Pusher channel above and now we need to simulate a reportComment action
                // Pusher event so we can verify that action was handled correctly and merged into the reportActions.
                PusherHelper.emitOnyxUpdate([
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`,
                        value: {
                            reportID: REPORT_ID,
                            participants: {
                                [TEST_USER_ACCOUNT_ID]: {
                                    notificationPreference: 'always',
                                },
                            },
                            lastVisibleActionCreated: '2022-11-22 03:48:27.267',
                            lastMessageText: 'Testing a comment',
                            lastActorAccountID: TEST_USER_ACCOUNT_ID,
                        },
                    },
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                        value: {
                            [reportActionID]: {pendingAction: null},
                        },
                    },
                ]);

                // Once a reportComment event is emitted to the Pusher channel we should see the comment get processed
                // by the Pusher callback and added to the storage so we must wait for promises to resolve again and
                // then verify the data is in Onyx.
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Verify there is only one action and our optimistic comment has been removed
                expect(Object.keys(reportActions ?? {}).length).toBe(1);

                const resultAction = reportActions?.[reportActionID];

                // Verify that our action is no longer in the loading state
                expect(resultAction?.pendingAction).toBeUndefined();
            });
    });

    it('should update pins in Onyx when togglePinned is called', () => {
        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_USER_LOGIN = 'test@test.com';
        const REPORT_ID = '1';

        let reportIsPinned: boolean;
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`,
            callback: (val) => (reportIsPinned = val?.isPinned ?? false),
        });

        // Set up Onyx with some test user data
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN)
            .then(() => {
                Report.togglePinnedState(REPORT_ID, false);
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Test that Onyx immediately updated the report pin state.
                expect(reportIsPinned).toEqual(true);
            });
    });

    it('Should not leave duplicate comments when logger sends packet because of calling process queue while processing the queue', () => {
        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_USER_LOGIN = 'test@test.com';
        const REPORT_ID = '1';
        const LOGGER_MAX_LOG_LINES = 50;

        // GIVEN a test user with initial data
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN)
            .then(() => TestHelper.setPersonalDetails(TEST_USER_LOGIN, TEST_USER_ACCOUNT_ID))
            .then(() => {
                global.fetch = TestHelper.getGlobalFetchMock();

                // WHEN we add enough logs to send a packet
                for (let i = 0; i <= LOGGER_MAX_LOG_LINES; i++) {
                    Log.info('Test log info');
                }

                // And leave a comment on a report
                Report.addComment(REPORT_ID, 'Testing a comment');

                // Then we should expect that there is on persisted request
                expect(PersistedRequests.getAll().length).toBe(1);

                // When we wait for the queue to run
                return waitForBatchedUpdates();
            })
            .then(() => {
                // THEN only ONE call to AddComment will happen
                const URL_ARGUMENT_INDEX = 0;
                const addCommentCalls = (global.fetch as jest.Mock).mock.calls.filter((callArguments: string[]) => callArguments.at(URL_ARGUMENT_INDEX)?.includes('AddComment'));
                expect(addCommentCalls.length).toBe(1);
            });
    });

    it('should be updated correctly when new comments are added, deleted or marked as unread', () => {
        jest.useFakeTimers();
        global.fetch = TestHelper.getGlobalFetchMock();
        const REPORT_ID = '1';
        let report: OnyxEntry<OnyxTypes.Report>;
        let reportActionCreatedDate: string;
        let currentTime: string;
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`,
            callback: (val) => (report = val),
        });

        let reportActions: OnyxTypes.ReportActions;
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (val) => (reportActions = val ?? {}),
        });

        const USER_1_LOGIN = 'user@test.com';
        const USER_1_ACCOUNT_ID = 1;
        const USER_2_ACCOUNT_ID = 2;
        const setPromise = Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportName: 'Test', reportID: REPORT_ID})
            .then(() => TestHelper.signInWithTestUser(USER_1_ACCOUNT_ID, USER_1_LOGIN))
            .then(waitForNetworkPromises)
            .then(() => {
                // Given a test user that is subscribed to Pusher events
                User.subscribeToUserEvents();
                return waitForBatchedUpdates();
            })
            .then(() => TestHelper.setPersonalDetails(USER_1_LOGIN, USER_1_ACCOUNT_ID))
            .then(() => {
                // When a Pusher event is handled for a new report comment that includes a mention of the current user
                reportActionCreatedDate = DateUtils.getDBTime();
                PusherHelper.emitOnyxUpdate([
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`,
                        value: {
                            reportID: REPORT_ID,
                            participants: {
                                [USER_1_ACCOUNT_ID]: {
                                    notificationPreference: 'always',
                                },
                            },
                            lastMessageText: 'Comment 1',
                            lastActorAccountID: USER_2_ACCOUNT_ID,
                            lastVisibleActionCreated: reportActionCreatedDate,
                            lastMentionedTime: reportActionCreatedDate,
                            lastReadTime: DateUtils.subtractMillisecondsFromDateTime(reportActionCreatedDate, 1),
                        },
                    },
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                        value: {
                            1: {
                                actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
                                actorAccountID: USER_2_ACCOUNT_ID,
                                automatic: false,
                                avatar: 'https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_3.png',
                                message: [{type: 'COMMENT', html: 'Comment 1', text: 'Comment 1'}],
                                person: [{type: 'TEXT', style: 'strong', text: 'Test User'}],
                                shouldShow: true,
                                created: reportActionCreatedDate,
                                reportActionID: '1',
                            },
                        },
                    },
                ]);
                return waitForNetworkPromises();
            })
            .then(() => {
                // Then the report will be unread
                expect(ReportUtils.isUnread(report)).toBe(true);

                // And show a green dot for unread mentions in the LHN
                expect(ReportUtils.isUnreadWithMention(report)).toBe(true);

                // When the user visits the report
                jest.advanceTimersByTime(10);
                currentTime = DateUtils.getDBTime();
                Report.openReport(REPORT_ID);
                Report.readNewestAction(REPORT_ID);
                waitForBatchedUpdates();
                return waitForBatchedUpdates();
            })
            .then(() => {
                // The report will be read
                expect(ReportUtils.isUnread(report)).toBe(false);
                expect(toZonedTime(report?.lastReadTime ?? '', UTC).getTime()).toBeGreaterThanOrEqual(toZonedTime(currentTime, UTC).getTime());

                // And no longer show the green dot for unread mentions in the LHN
                expect(ReportUtils.isUnreadWithMention(report)).toBe(false);

                // When the user manually marks a message as "unread"
                jest.advanceTimersByTime(10);
                Report.markCommentAsUnread(REPORT_ID, reportActionCreatedDate);
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Then the report will be unread and show the green dot for unread mentions in LHN
                expect(ReportUtils.isUnread(report)).toBe(true);
                expect(ReportUtils.isUnreadWithMention(report)).toBe(true);
                expect(report?.lastReadTime).toBe(DateUtils.subtractMillisecondsFromDateTime(reportActionCreatedDate, 1));

                // When a new comment is added by the current user
                jest.advanceTimersByTime(10);
                currentTime = DateUtils.getDBTime();
                Report.addComment(REPORT_ID, 'Current User Comment 1');
                return waitForBatchedUpdates();
            })
            .then(() => {
                // The report will be read, the green dot for unread mentions will go away, and the lastReadTime updated
                expect(ReportUtils.isUnread(report)).toBe(false);
                expect(ReportUtils.isUnreadWithMention(report)).toBe(false);
                expect(toZonedTime(report?.lastReadTime ?? '', UTC).getTime()).toBeGreaterThanOrEqual(toZonedTime(currentTime, UTC).getTime());
                expect(report?.lastMessageText).toBe('Current User Comment 1');

                // When another comment is added by the current user
                jest.advanceTimersByTime(10);
                currentTime = DateUtils.getDBTime();
                Report.addComment(REPORT_ID, 'Current User Comment 2');
                return waitForBatchedUpdates();
            })
            .then(() => {
                // The report will be read and the lastReadTime updated
                expect(ReportUtils.isUnread(report)).toBe(false);
                expect(toZonedTime(report?.lastReadTime ?? '', UTC).getTime()).toBeGreaterThanOrEqual(toZonedTime(currentTime, UTC).getTime());
                expect(report?.lastMessageText).toBe('Current User Comment 2');

                // When another comment is added by the current user
                jest.advanceTimersByTime(10);
                currentTime = DateUtils.getDBTime();
                Report.addComment(REPORT_ID, 'Current User Comment 3');
                return waitForBatchedUpdates();
            })
            .then(() => {
                // The report will be read and the lastReadTime updated
                expect(ReportUtils.isUnread(report)).toBe(false);
                expect(toZonedTime(report?.lastReadTime ?? '', UTC).getTime()).toBeGreaterThanOrEqual(toZonedTime(currentTime, UTC).getTime());
                expect(report?.lastMessageText).toBe('Current User Comment 3');

                const USER_1_BASE_ACTION = {
                    actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
                    actorAccountID: USER_1_ACCOUNT_ID,
                    automatic: false,
                    avatar: 'https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_3.png',
                    person: [{type: 'TEXT', style: 'strong', text: 'Test User'}],
                    shouldShow: true,
                    created: DateUtils.getDBTime(Date.now() - 3),
                };

                jest.advanceTimersByTime(10);
                const optimisticReportActions: OnyxUpdate = {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                    value: {
                        200: {
                            ...USER_1_BASE_ACTION,
                            message: [{type: 'COMMENT', html: 'Current User Comment 1', text: 'Current User Comment 1'}],
                            created: DateUtils.getDBTime(Date.now() - 2),
                            reportActionID: '200',
                        },

                        300: {
                            ...USER_1_BASE_ACTION,
                            message: [{type: 'COMMENT', html: 'Current User Comment 2', text: 'Current User Comment 2'}],
                            created: DateUtils.getDBTime(Date.now() - 1),
                            reportActionID: '300',
                        },

                        400: {
                            ...USER_1_BASE_ACTION,
                            message: [{type: 'COMMENT', html: 'Current User Comment 3', text: 'Current User Comment 3'}],
                            created: DateUtils.getDBTime(),
                            reportActionID: '400',
                        },
                    },
                };
                jest.advanceTimersByTime(10);
                reportActionCreatedDate = DateUtils.getDBTime();

                if (optimisticReportActions.value?.[400]) {
                    optimisticReportActions.value[400].created = reportActionCreatedDate;
                }

                // When we emit the events for these pending created actions to update them to not pending
                PusherHelper.emitOnyxUpdate([
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`,
                        value: {
                            reportID: REPORT_ID,
                            participants: {
                                [USER_1_ACCOUNT_ID]: {
                                    notificationPreference: 'always',
                                },
                            },
                            lastMessageText: 'Current User Comment 3',
                            lastActorAccountID: 1,
                            lastVisibleActionCreated: reportActionCreatedDate,
                            lastReadTime: reportActionCreatedDate,
                        },
                    },
                    optimisticReportActions,
                ]);

                return waitForNetworkPromises();
            })
            .then(() => {
                // If the user deletes a comment that is before the last read
                Report.deleteReportComment(REPORT_ID, {...reportActions[200]});
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Then no change will occur
                expect(report?.lastReadTime).toBe(reportActionCreatedDate);
                expect(ReportUtils.isUnread(report)).toBe(false);

                // When the user manually marks a message as "unread"
                Report.markCommentAsUnread(REPORT_ID, reportActionCreatedDate);
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Then we should expect the report to be to be unread
                expect(ReportUtils.isUnread(report)).toBe(true);
                expect(report?.lastReadTime).toBe(DateUtils.subtractMillisecondsFromDateTime(reportActionCreatedDate, 1));

                // If the user deletes the last comment after the lastReadTime the lastMessageText will reflect the new last comment
                Report.deleteReportComment(REPORT_ID, {...reportActions[400]});
                return waitForBatchedUpdates();
            })
            .then(() => {
                expect(ReportUtils.isUnread(report)).toBe(false);
                expect(report?.lastMessageText).toBe('Current User Comment 2');
            });
        waitForBatchedUpdates(); // flushing onyx.set as it will be batched
        return setPromise;
    });

    it('Should properly update comment with links', () => {
        /* This tests a variety of scenarios when a user edits a comment.
         * We should generate a link when editing a message unless the link was
         * already in the comment and the user deleted it on purpose.
         */

        global.fetch = TestHelper.getGlobalFetchMock();

        // User edits comment to add link
        // We should generate link
        let originalCommentMarkdown = 'Original Comment';
        let afterEditCommentText = 'Original Comment www.google.com';
        let newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        let expectedOutput = 'Original Comment <a href="https://www.google.com" target="_blank" rel="noreferrer noopener">www.google.com</a>';
        expect(newCommentHTML).toBe(expectedOutput);

        // User deletes www.google.com link from comment but keeps link text
        // We should not generate link
        originalCommentMarkdown = 'Comment [www.google.com](https://www.google.com)';
        afterEditCommentText = 'Comment www.google.com';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = 'Comment www.google.com';
        expect(newCommentHTML).toBe(expectedOutput);

        // User Delete only () part of link but leaves the []
        // We should not generate link
        originalCommentMarkdown = 'Comment [www.google.com](https://www.google.com)';
        afterEditCommentText = 'Comment [www.google.com]';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = 'Comment [www.google.com]';
        expect(newCommentHTML).toBe(expectedOutput);

        // User Generates multiple links in one edit
        // We should generate both links
        originalCommentMarkdown = 'Comment';
        afterEditCommentText = 'Comment www.google.com www.facebook.com';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput =
            'Comment <a href="https://www.google.com" target="_blank" rel="noreferrer noopener">www.google.com</a> ' +
            '<a href="https://www.facebook.com" target="_blank" rel="noreferrer noopener">www.facebook.com</a>';
        expect(newCommentHTML).toBe(expectedOutput);

        // Comment has two links but user deletes only one of them
        // Should not generate link again for the deleted one
        originalCommentMarkdown = 'Comment [www.google.com](https://www.google.com)  [www.facebook.com](https://www.facebook.com)';
        afterEditCommentText = 'Comment www.google.com  [www.facebook.com](https://www.facebook.com)';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = 'Comment www.google.com  <a href="https://www.facebook.com" target="_blank" rel="noreferrer noopener">www.facebook.com</a>';
        expect(newCommentHTML).toBe(expectedOutput);

        // User edits and replaces comment with a link containing underscores
        // We should generate link
        originalCommentMarkdown = 'Comment';
        afterEditCommentText = 'https://www.facebook.com/hashtag/__main/?__eep__=6';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = '<a href="https://www.facebook.com/hashtag/__main/?__eep__=6" target="_blank" rel="noreferrer noopener">https://www.facebook.com/hashtag/__main/?__eep__=6</a>';
        expect(newCommentHTML).toBe(expectedOutput);

        // User edits and deletes the link containing underscores
        // We should not generate link
        originalCommentMarkdown = '[https://www.facebook.com/hashtag/__main/?__eep__=6](https://www.facebook.com/hashtag/__main/?__eep__=6)';
        afterEditCommentText = 'https://www.facebook.com/hashtag/__main/?__eep__=6';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = 'https://www.facebook.com/hashtag/__main/?__eep__=6';
        expect(newCommentHTML).toBe(expectedOutput);

        // User edits and replaces comment with a link containing asterisks
        // We should generate link
        originalCommentMarkdown = 'Comment';
        afterEditCommentText = 'http://example.com/foo/*/bar/*/test.txt';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = '<a href="http://example.com/foo/*/bar/*/test.txt" target="_blank" rel="noreferrer noopener">http://example.com/foo/*/bar/*/test.txt</a>';
        expect(newCommentHTML).toBe(expectedOutput);

        // User edits and deletes the link containing asterisks
        // We should not generate link
        originalCommentMarkdown = '[http://example.com/foo/*/bar/*/test.txt](http://example.com/foo/*/bar/*/test.txt)';
        afterEditCommentText = 'http://example.com/foo/*/bar/*/test.txt';
        newCommentHTML = Report.handleUserDeletedLinksInHtml(afterEditCommentText, originalCommentMarkdown);
        expectedOutput = 'http://example.com/foo/*/bar/*/test.txt';
        expect(newCommentHTML).toBe(expectedOutput);
    });

    it('should show a notification for report action updates with shouldNotify', () => {
        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const REPORT_ACTION = {
            actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        };

        // Setup user and pusher listeners
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID)
            .then(waitForBatchedUpdates)
            .then(() => {
                User.subscribeToUserEvents();
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Simulate a Pusher Onyx update with a report action with shouldNotify
                PusherHelper.emitOnyxUpdate([
                    {
                        onyxMethod: Onyx.METHOD.MERGE,
                        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                        value: {
                            1: REPORT_ACTION,
                        },
                        shouldNotify: true,
                    },
                ]);
                return SequentialQueue.getCurrentRequest().then(waitForBatchedUpdates);
            })
            .then(() => {
                // Ensure we show a notification for this new report action
                expect(Report.showReportActionNotification).toBeCalledWith(REPORT_ID, REPORT_ACTION);
            });
    });

    it('should properly toggle reactions on a message', () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_USER_LOGIN = 'test@test.com';
        const REPORT_ID = '1';
        const EMOJI_CODE = '👍';
        const EMOJI_SKIN_TONE = 2;
        const EMOJI_NAME = '+1';
        const EMOJI = {
            code: EMOJI_CODE,
            name: EMOJI_NAME,
            types: ['👍🏿', '👍🏾', '👍🏽', '👍🏼', '👍🏻'],
        };

        let reportActions: OnyxTypes.ReportActions;
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (val) => (reportActions = val ?? {}),
        });
        const reportActionsReactions: OnyxCollection<OnyxTypes.ReportActionReactions> = {};
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS,
            callback: (val, key) => {
                reportActionsReactions[key] = val ?? {};
            },
        });
        let reportAction: OnyxTypes.ReportAction | undefined;
        let reportActionID: string;

        // Set up Onyx with some test user data
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN)
            .then(() => {
                User.subscribeToUserEvents();
                return waitForBatchedUpdates();
            })
            .then(() => TestHelper.setPersonalDetails(TEST_USER_LOGIN, TEST_USER_ACCOUNT_ID))
            .then(() => {
                // This is a fire and forget response, but once it completes we should be able to verify that we
                // have an "optimistic" report action in Onyx.
                Report.addComment(REPORT_ID, 'Testing a comment');
                return waitForBatchedUpdates();
            })
            .then(() => {
                reportAction = Object.values(reportActions).at(0);
                reportActionID = reportAction?.reportActionID ?? '-1';

                if (reportAction) {
                    // Add a reaction to the comment
                    Report.toggleEmojiReaction(REPORT_ID, reportAction, EMOJI, reportActionsReactions[0]);
                }
                return waitForBatchedUpdates();
            })
            .then(() => {
                reportAction = Object.values(reportActions).at(0);

                // Expect the reaction to exist in the reportActionsReactions collection
                expect(reportActionsReactions).toHaveProperty(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`);

                // Expect the reaction to have the emoji on it
                const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`];
                expect(reportActionReaction).toHaveProperty(EMOJI.name);

                // Expect the emoji to have the user accountID
                const reportActionReactionEmoji = reportActionReaction?.[EMOJI.name];
                expect(reportActionReactionEmoji?.users).toHaveProperty(`${TEST_USER_ACCOUNT_ID}`);

                if (reportAction) {
                    // Now we remove the reaction
                    Report.toggleEmojiReaction(REPORT_ID, reportAction, EMOJI, reportActionReaction);
                }
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Expect the reaction to have null where the users reaction used to be
                expect(reportActionsReactions).toHaveProperty(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`);
                const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`];
                expect(reportActionReaction?.[EMOJI.name].users[TEST_USER_ACCOUNT_ID]).toBeUndefined();
            })
            .then(() => {
                reportAction = Object.values(reportActions).at(0);

                if (reportAction) {
                    // Add the same reaction to the same report action with a different skintone
                    Report.toggleEmojiReaction(REPORT_ID, reportAction, EMOJI, reportActionsReactions[0]);
                }
                return waitForBatchedUpdates()
                    .then(() => {
                        reportAction = Object.values(reportActions).at(0);

                        const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`];
                        if (reportAction) {
                            Report.toggleEmojiReaction(REPORT_ID, reportAction, EMOJI, reportActionReaction, EMOJI_SKIN_TONE);
                        }
                        return waitForBatchedUpdates();
                    })
                    .then(() => {
                        reportAction = Object.values(reportActions).at(0);

                        // Expect the reaction to exist in the reportActionsReactions collection
                        expect(reportActionsReactions).toHaveProperty(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`);

                        // Expect the reaction to have the emoji on it
                        const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`];
                        expect(reportActionReaction).toHaveProperty(EMOJI.name);

                        // Expect the emoji to have the user accountID
                        const reportActionReactionEmoji = reportActionReaction?.[EMOJI.name];
                        expect(reportActionReactionEmoji?.users).toHaveProperty(`${TEST_USER_ACCOUNT_ID}`);

                        // Expect two different skintone reactions
                        const reportActionReactionEmojiUserSkinTones = reportActionReactionEmoji?.users[TEST_USER_ACCOUNT_ID].skinTones;
                        expect(reportActionReactionEmojiUserSkinTones).toHaveProperty('-1');
                        expect(reportActionReactionEmojiUserSkinTones).toHaveProperty('2');

                        if (reportAction) {
                            // Now we remove the reaction, and expect that both variations are removed
                            Report.toggleEmojiReaction(REPORT_ID, reportAction, EMOJI, reportActionReaction);
                        }
                        return waitForBatchedUpdates();
                    })
                    .then(() => {
                        // Expect the reaction to have null where the users reaction used to be
                        expect(reportActionsReactions).toHaveProperty(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`);
                        const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`];
                        expect(reportActionReaction?.[EMOJI.name].users[TEST_USER_ACCOUNT_ID]).toBeUndefined();
                    });
            });
    });

    it("shouldn't add the same reaction twice when changing preferred skin color and reaction doesn't support skin colors", () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_USER_LOGIN = 'test@test.com';
        const REPORT_ID = '1';
        const EMOJI_CODE = '😄';
        const EMOJI_NAME = 'smile';
        const EMOJI = {
            code: EMOJI_CODE,
            name: EMOJI_NAME,
        };

        let reportActions: OnyxTypes.ReportActions = {};
        Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (val) => (reportActions = val ?? {}),
        });
        const reportActionsReactions: OnyxCollection<OnyxTypes.ReportActionReactions> = {};
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS,
            callback: (val, key) => {
                reportActionsReactions[key] = val ?? {};
            },
        });

        let resultAction: OnyxTypes.ReportAction | undefined;

        // Set up Onyx with some test user data
        return TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN)
            .then(() => {
                User.subscribeToUserEvents();
                return waitForBatchedUpdates();
            })
            .then(() => TestHelper.setPersonalDetails(TEST_USER_LOGIN, TEST_USER_ACCOUNT_ID))
            .then(() => {
                // This is a fire and forget response, but once it completes we should be able to verify that we
                // have an "optimistic" report action in Onyx.
                Report.addComment(REPORT_ID, 'Testing a comment');
                return waitForBatchedUpdates();
            })
            .then(() => {
                resultAction = Object.values(reportActions).at(0);

                if (resultAction) {
                    // Add a reaction to the comment
                    Report.toggleEmojiReaction(REPORT_ID, resultAction, EMOJI, {});
                }
                return waitForBatchedUpdates();
            })
            .then(() => {
                resultAction = Object.values(reportActions).at(0);

                // Now we toggle the reaction while the skin tone has changed.
                // As the emoji doesn't support skin tones, the emoji
                // should get removed instead of added again.
                const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${resultAction?.reportActionID}`];
                if (resultAction) {
                    Report.toggleEmojiReaction(REPORT_ID, resultAction, EMOJI, reportActionReaction, 2);
                }
                return waitForBatchedUpdates();
            })
            .then(() => {
                // Expect the reaction to have null where the users reaction used to be
                expect(reportActionsReactions).toHaveProperty(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${resultAction?.reportActionID}`);
                const reportActionReaction = reportActionsReactions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${resultAction?.reportActionID}`];
                expect(reportActionReaction?.[EMOJI.name].users[TEST_USER_ACCOUNT_ID]).toBeUndefined();
            });
    });

    it('should send only one OpenReport, replacing any extra ones with same reportIDs', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const REPORT_ID = '1';

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});
        await waitForBatchedUpdates();

        for (let i = 0; i < 5; i++) {
            Report.openReport(REPORT_ID, undefined, ['test@user.com'], {
                isOptimisticReport: true,
                reportID: REPORT_ID,
            });
        }

        expect(PersistedRequests.getAll().length).toBe(1);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.OPEN_REPORT, 1);
    });

    it('should replace duplicate OpenReport commands with the same reportID', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const REPORT_ID = '1';

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});
        await waitForBatchedUpdates();

        for (let i = 0; i < 8; i++) {
            let reportID = REPORT_ID;
            if (i > 4) {
                reportID = `${i}`;
            }
            Report.openReport(reportID, undefined, ['test@user.com'], {
                isOptimisticReport: true,
                reportID: REPORT_ID,
            });
        }

        expect(PersistedRequests.getAll().length).toBe(4);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.OPEN_REPORT, 4);
    });

    it('should remove AddComment and UpdateComment without sending any request when DeleteComment is set', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        Report.addComment(REPORT_ID, 'Testing a comment');
        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);
        Report.editReportComment(REPORT_ID, reportAction, 'Testing an edited comment');

        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);

                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_COMMENT);
                    expect(persistedRequests?.at(1)?.command).toBeUndefined();

                    resolve();
                },
            });
        });

        // Checking the Report Action exists before deleting it
        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                callback: (reportActions) => {
                    Onyx.disconnect(connection);

                    expect(reportActions?.[reportActionID]).not.toBeNull();
                    expect(reportActions?.[reportActionID].reportActionID).toBe(reportActionID);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(0);

        // Checking the Report Action doesn't exist after deleting it
        const connection = Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (reportActions) => {
                Onyx.disconnect(connection);
                expect(reportActions?.[reportActionID]).toBeUndefined();
            },
        });

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.UPDATE_COMMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 0);
    });

    it('should send DeleteComment request and remove UpdateComment accordingly', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        Report.addComment(REPORT_ID, 'Testing a comment');

        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(1);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        Report.editReportComment(REPORT_ID, reportAction, 'Testing an edited comment');

        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);
                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.UPDATE_COMMENT);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(1);

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 1);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.UPDATE_COMMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 1);
    });

    it('should send DeleteComment request after AddComment is rollbacked', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError(CONST.ERROR.FAILED_TO_FETCH));

        const mockedXhr = jest.fn();
        mockedXhr
            .mockImplementationOnce(originalXHR)
            .mockImplementationOnce(() =>
                Promise.resolve({
                    jsonCode: CONST.JSON_CODE.EXP_ERROR,
                }),
            )
            .mockImplementation(() =>
                Promise.resolve({
                    jsonCode: CONST.JSON_CODE.SUCCESS,
                }),
            );

        HttpUtils.xhr = mockedXhr;
        await waitForBatchedUpdates();
        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        Report.addComment(REPORT_ID, 'Testing a comment');
        await waitForNetworkPromises();

        const newComment = PersistedRequests.getAll().at(1);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        await waitForBatchedUpdates();

        expect(PersistedRequests.getAll().length).toBe(1);
        expect(PersistedRequests.getAll().at(0)?.isRollbacked).toBeTruthy();
        Report.deleteReportComment(REPORT_ID, reportAction);

        jest.runOnlyPendingTimers();
        await waitForBatchedUpdates();

        const httpCalls = (HttpUtils.xhr as Mock).mock.calls;

        const addCommentCalls = httpCalls.filter(([command]) => command === 'AddComment');
        const deleteCommentCalls = httpCalls.filter(([command]) => command === 'DeleteComment');

        if (httpCalls.length === 3) {
            expect(addCommentCalls).toHaveLength(2);
            expect(deleteCommentCalls).toHaveLength(1);
        }
    });

    it('should send not DeleteComment request and remove AddAttachment accordingly', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        const file = new File([''], 'test.txt', {type: 'text/plain'});
        Report.addAttachment(REPORT_ID, file);

        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        // wait for Onyx.connect execute the callback and start processing the queue
        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);
                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_ATTACHMENT);
                    resolve();
                },
            });
        });

        // Checking the Report Action exists before deleting it
        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                callback: (reportActions) => {
                    Onyx.disconnect(connection);
                    expect(reportActions?.[reportActionID]).not.toBeNull();
                    expect(reportActions?.[reportActionID].reportActionID).toBe(reportActionID);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(0);

        // Checking the Report Action doesn't exist after deleting it
        const connection = Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (reportActions) => {
                Onyx.disconnect(connection);
                expect(reportActions?.[reportActionID]).toBeUndefined();
            },
        });

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_ATTACHMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 0);
    });

    it('should send not DeleteComment request and remove AddTextAndAttachment accordingly', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);
        const file = new File([''], 'test.txt', {type: 'text/plain'});

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        Report.addAttachment(REPORT_ID, file, 'Attachment with comment');

        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        // wait for Onyx.connect execute the callback and start processing the queue
        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);
                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_TEXT_AND_ATTACHMENT);
                    resolve();
                },
            });
        });

        // Checking the Report Action exists before deleting it
        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                callback: (reportActions) => {
                    Onyx.disconnect(connection);
                    expect(reportActions?.[reportActionID]).not.toBeNull();
                    expect(reportActions?.[reportActionID].reportActionID).toBe(reportActionID);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(0);

        // Checking the Report Action doesn't exist after deleting it
        const connection = Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (reportActions) => {
                Onyx.disconnect(connection);
                expect(reportActions?.[reportActionID]).toBeUndefined();
            },
        });

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_TEXT_AND_ATTACHMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 0);
    });

    it('should not send DeleteComment request and remove any Reactions accordingly', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        jest.spyOn(EmojiUtils, 'hasAccountIDEmojiReacted').mockImplementation(() => true);
        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});
        await Promise.resolve();

        Report.addComment(REPORT_ID, 'reactions with comment');
        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        await waitForBatchedUpdates();

        Report.toggleEmojiReaction(REPORT_ID, reportAction, {name: 'smile', code: '😄'}, {});
        Report.toggleEmojiReaction(
            REPORT_ID,
            reportAction,
            {name: 'smile', code: '😄'},
            {
                smile: {
                    createdAt: '2024-10-14 14:58:12',
                    oldestTimestamp: '2024-10-14 14:58:12',
                    users: {
                        [`${TEST_USER_ACCOUNT_ID}`]: {
                            id: `${TEST_USER_ACCOUNT_ID}`,
                            oldestTimestamp: '2024-10-14 14:58:12',
                            skinTones: {
                                '-1': '2024-10-14 14:58:12',
                            },
                        },
                    },
                },
            },
        );

        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);
                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_COMMENT);
                    expect(persistedRequests?.at(1)?.command).toBe(WRITE_COMMANDS.ADD_EMOJI_REACTION);
                    expect(persistedRequests?.at(2)?.command).toBe(WRITE_COMMANDS.REMOVE_EMOJI_REACTION);
                    resolve();
                },
            });
        });

        // Checking the Report Action exists before deleting it
        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
                callback: (reportActions) => {
                    Onyx.disconnect(connection);
                    expect(reportActions?.[reportActionID]).not.toBeNull();
                    expect(reportActions?.[reportActionID].reportActionID).toBe(reportActionID);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(0);

        // Checking the Report Action doesn't exist after deleting it
        const connection = Onyx.connect({
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`,
            callback: (reportActions) => {
                Onyx.disconnect(connection);
                expect(reportActions?.[reportActionID]).toBeUndefined();
            },
        });

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_EMOJI_REACTION, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.REMOVE_EMOJI_REACTION, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 0);
    });

    it('should send DeleteComment request and remove any Reactions accordingly', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        jest.spyOn(EmojiUtils, 'hasAccountIDEmojiReacted').mockImplementation(() => true);
        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        Report.addComment(REPORT_ID, 'Attachment with comment');

        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        // wait for Onyx.connect execute the callback and start processing the queue
        await Promise.resolve();

        Report.toggleEmojiReaction(REPORT_ID, reportAction, {name: 'smile', code: '😄'}, {});
        Report.toggleEmojiReaction(
            REPORT_ID,
            reportAction,
            {name: 'smile', code: '😄'},
            {
                smile: {
                    createdAt: '2024-10-14 14:58:12',
                    oldestTimestamp: '2024-10-14 14:58:12',
                    users: {
                        [`${TEST_USER_ACCOUNT_ID}`]: {
                            id: `${TEST_USER_ACCOUNT_ID}`,
                            oldestTimestamp: '2024-10-14 14:58:12',
                            skinTones: {
                                '-1': '2024-10-14 14:58:12',
                            },
                        },
                    },
                },
            },
        );

        await waitForBatchedUpdates();
        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);
                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_EMOJI_REACTION);
                    expect(persistedRequests?.at(1)?.command).toBe(WRITE_COMMANDS.REMOVE_EMOJI_REACTION);
                    resolve();
                },
            });
        });

        Report.deleteReportComment(REPORT_ID, reportAction);

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(1);

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 1);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_EMOJI_REACTION, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.REMOVE_EMOJI_REACTION, 0);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 1);
    });

    it('should create and delete thread processing all the requests', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});
        await waitForBatchedUpdates();

        Report.addComment(REPORT_ID, 'Testing a comment');

        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);

        Report.openReport(
            REPORT_ID,
            undefined,
            ['test@user.com'],
            {
                isOptimisticReport: true,
                parentReportID: REPORT_ID,
                parentReportActionID: reportActionID,
                reportID: '2',
            },
            reportActionID,
        );

        Report.deleteReportComment(REPORT_ID, reportAction);

        expect(PersistedRequests.getAll().length).toBe(3);

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    if (persistedRequests?.length !== 3) {
                        return;
                    }
                    Onyx.disconnect(connection);

                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_COMMENT);
                    expect(persistedRequests?.at(1)?.command).toBe(WRITE_COMMANDS.OPEN_REPORT);
                    expect(persistedRequests?.at(2)?.command).toBe(WRITE_COMMANDS.DELETE_COMMENT);
                    resolve();
                },
            });
        });

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 1);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.OPEN_REPORT, 1);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.DELETE_COMMENT, 1);
    });

    it('should update AddComment text with the UpdateComment text, sending just an AddComment request', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();

        const TEST_USER_ACCOUNT_ID = 1;
        const REPORT_ID = '1';
        const TEN_MINUTES_AGO = subMinutes(new Date(), 10);
        const created = format(addSeconds(TEN_MINUTES_AGO, 10), CONST.DATE.FNS_DB_FORMAT_STRING);

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        Report.addComment(REPORT_ID, 'Testing a comment');
        // Need the reportActionID to delete the comments
        const newComment = PersistedRequests.getAll().at(0);
        const reportActionID = (newComment?.data?.reportActionID as string) ?? '-1';
        const reportAction = TestHelper.buildTestReportComment(created, TEST_USER_ACCOUNT_ID, reportActionID);
        Report.editReportComment(REPORT_ID, reportAction, 'Testing an edited comment');

        await waitForBatchedUpdates();

        await new Promise<void>((resolve) => {
            const connection = Onyx.connect({
                key: ONYXKEYS.PERSISTED_REQUESTS,
                callback: (persistedRequests) => {
                    Onyx.disconnect(connection);

                    expect(persistedRequests?.at(0)?.command).toBe(WRITE_COMMANDS.ADD_COMMENT);

                    resolve();
                },
            });
        });

        await waitForBatchedUpdates();
        expect(PersistedRequests.getAll().length).toBe(1);

        Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});
        await waitForBatchedUpdates();

        // Checking no requests were or will be made
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.ADD_COMMENT, 1);
        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.UPDATE_COMMENT, 0);
    });

    it('it should only send the last sequential UpdateComment request to BE', async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        const reportID = '123';

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        const action: OnyxEntry<OnyxTypes.ReportAction> = {
            reportID,
            reportActionID: '722',
            actionName: 'ADDCOMMENT',
            created: '2024-10-21 10:37:59.881',
        };

        Report.editReportComment(reportID, action, 'value1');
        Report.editReportComment(reportID, action, 'value2');
        Report.editReportComment(reportID, action, 'value3');

        const requests = PersistedRequests?.getAll();

        expect(requests.length).toBe(1);
        expect(requests?.at(0)?.command).toBe(WRITE_COMMANDS.UPDATE_COMMENT);
        expect(requests?.at(0)?.data?.reportComment).toBe('value3');

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        TestHelper.expectAPICommandToHaveBeenCalled(WRITE_COMMANDS.UPDATE_COMMENT, 1);
    });
});
