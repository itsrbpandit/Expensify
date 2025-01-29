import {beforeEach, jest, test} from '@jest/globals';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import {confirmReadyToOpenApp, openApp, reconnectApp} from '@libs/actions/App';
import OnyxUpdateManager from '@libs/actions/OnyxUpdateManager';
import {WRITE_COMMANDS} from '@libs/API/types';
import HttpUtils from '@libs/HttpUtils';
import PushNotification from '@libs/Notification/PushNotification';
// This lib needs to be imported, but it has nothing to export since all it contains is an Onyx connection
import '@libs/Notification/PushNotification/subscribePushNotification';
import {getAll} from '@userActions/PersistedRequests';
import CONST from '@src/CONST';
import * as SessionUtil from '@src/libs/actions/Session';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Credentials, Session} from '@src/types/onyx';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

// We are mocking this method so that we can later test to see if it was called and what arguments it was called with.
// We test HttpUtils.xhr() since this means that our API command turned into a network request and isn't only queued.
HttpUtils.xhr = jest.fn<typeof HttpUtils.xhr>();

// Mocked to ensure push notifications are subscribed/unsubscribed as the session changes
jest.mock('@libs/Notification/PushNotification');

Onyx.init({
    keys: ONYXKEYS,
});

OnyxUpdateManager();
beforeEach(() => Onyx.clear().then(waitForBatchedUpdates));

describe('Session', () => {
    test('Authenticate is called with saved credentials when a session expires', async () => {
        // Given a test user and set of authToken with subscriptions to session and credentials
        const TEST_USER_LOGIN = 'test@testguy.com';
        const TEST_USER_ACCOUNT_ID = 1;
        const TEST_INITIAL_AUTH_TOKEN = 'initialAuthToken';
        const TEST_REFRESHED_AUTH_TOKEN = 'refreshedAuthToken';

        let credentials: OnyxEntry<Credentials>;
        Onyx.connect({
            key: ONYXKEYS.CREDENTIALS,
            callback: (val) => (credentials = val),
        });

        let session: OnyxEntry<Session>;
        Onyx.connect({
            key: ONYXKEYS.SESSION,
            callback: (val) => (session = val),
        });

        // When we sign in with the test user
        await TestHelper.signInWithTestUser(TEST_USER_ACCOUNT_ID, TEST_USER_LOGIN, 'Password1', TEST_INITIAL_AUTH_TOKEN);
        await waitForBatchedUpdates();

        // Then our re-authentication credentials should be generated and our session data
        // have the correct information + initial authToken.
        expect(credentials?.login).toBe(TEST_USER_LOGIN);
        expect(credentials?.autoGeneratedLogin).not.toBeUndefined();
        expect(credentials?.autoGeneratedPassword).not.toBeUndefined();
        expect(session?.authToken).toBe(TEST_INITIAL_AUTH_TOKEN);
        expect(session?.accountID).toBe(TEST_USER_ACCOUNT_ID);
        expect(session?.email).toBe(TEST_USER_LOGIN);

        // At this point we have an authToken. To simulate it expiring we'll just make another
        // request and mock the response so it returns 407. Once this happens we should attempt
        // to Re-Authenticate with the stored credentials. Our next call will be to Authenticate
        // so we will mock that response with a new authToken and then verify that Onyx has our
        // data.
        (HttpUtils.xhr as jest.MockedFunction<typeof HttpUtils.xhr>)

            // This will make the call to OpenApp below return with an expired session code
            .mockImplementationOnce(() =>
                Promise.resolve({
                    jsonCode: CONST.JSON_CODE.NOT_AUTHENTICATED,
                }),
            )

            // The next call should be Authenticate since we are reauthenticating
            .mockImplementationOnce(() =>
                Promise.resolve({
                    jsonCode: CONST.JSON_CODE.SUCCESS,
                    accountID: TEST_USER_ACCOUNT_ID,
                    authToken: TEST_REFRESHED_AUTH_TOKEN,
                    email: TEST_USER_LOGIN,
                }),
            );

        // When we attempt to fetch the initial app data via the API
        confirmReadyToOpenApp();
        openApp();
        await waitForBatchedUpdates();

        // Then it should fail and reauthenticate the user adding the new authToken to the session
        // data in Onyx
        expect(session?.authToken).toBe(TEST_REFRESHED_AUTH_TOKEN);
    });

    test('Push notifications are subscribed after signing in', async () => {
        await TestHelper.signInWithTestUser();
        await waitForBatchedUpdates();
        expect(PushNotification.register).toBeCalled();
    });

    test('Push notifications are unsubscribed after signing out', async () => {
        await TestHelper.signInWithTestUser();
        await TestHelper.signOutTestUser();
        expect(PushNotification.deregister).toBeCalled();
    });

    test('ReconnectApp should push request to the queue', async () => {
        await TestHelper.signInWithTestUser();
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        confirmReadyToOpenApp();
        reconnectApp();

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(1);
        expect(getAll().at(0)?.command).toBe(WRITE_COMMANDS.RECONNECT_APP);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(0);
    });

    test('ReconnectApp should replace same requests from the queue', async () => {
        await TestHelper.signInWithTestUser();
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        confirmReadyToOpenApp();
        reconnectApp();
        reconnectApp();
        reconnectApp();
        reconnectApp();

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(1);
        expect(getAll().at(0)?.command).toBe(WRITE_COMMANDS.RECONNECT_APP);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        expect(getAll().length).toBe(0);
    });

    test('OpenApp should push request to the queue', async () => {
        await TestHelper.signInWithTestUser();
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        openApp();

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(1);
        expect(getAll().at(0)?.command).toBe(WRITE_COMMANDS.OPEN_APP);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(0);
    });

    test('OpenApp should replace same requests from the queue', async () => {
        await TestHelper.signInWithTestUser();
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        openApp();
        openApp();
        openApp();
        openApp();

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(1);
        expect(getAll().at(0)?.command).toBe(WRITE_COMMANDS.OPEN_APP);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        expect(getAll().length).toBe(0);
    });

    test('LogOut should replace same requests from the queue instead of adding new one', async () => {
        await TestHelper.signInWithTestUser();
        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: true});

        SessionUtil.signOut();
        SessionUtil.signOut();
        SessionUtil.signOut();
        SessionUtil.signOut();
        SessionUtil.signOut();

        await waitForBatchedUpdates();

        expect(getAll().length).toBe(1);
        expect(getAll().at(0)?.command).toBe(WRITE_COMMANDS.LOG_OUT);

        await Onyx.set(ONYXKEYS.NETWORK, {isOffline: false});

        expect(getAll().length).toBe(0);
    });
});
