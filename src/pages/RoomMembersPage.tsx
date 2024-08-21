import {useIsFocused} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {useOnyx, withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import Button from '@components/Button';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption, RoomMemberBulkActionType} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import {usePersonalDetails} from '@components/OnyxProvider';
import ScreenWrapper from '@components/ScreenWrapper';
import TableListItem from '@components/SelectionList/TableListItem';
import type {ListItem} from '@components/SelectionList/types';
import SelectionListWithModal from '@components/SelectionListWithModal';
import Text from '@components/Text';
import type {WithCurrentUserPersonalDetailsProps} from '@components/withCurrentUserPersonalDetails';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import localeCompare from '@libs/LocaleCompare';
import Navigation from '@libs/Navigation/Navigation';
import type {RoomMembersNavigatorParamList} from '@libs/Navigation/types';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as PersonalDetailsUtils from '@libs/PersonalDetailsUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as ReportUtils from '@libs/ReportUtils';
import StringUtils from '@libs/StringUtils';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Session} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {WithReportOrNotFoundProps} from './home/report/withReportOrNotFound';
import withReportOrNotFound from './home/report/withReportOrNotFound';
import SearchInputManager from './workspace/SearchInputManager';

type RoomMembersPageOnyxProps = {
    session: OnyxEntry<Session>;
};

type RoomMembersPageProps = WithReportOrNotFoundProps &
    WithCurrentUserPersonalDetailsProps &
    RoomMembersPageOnyxProps &
    StackScreenProps<RoomMembersNavigatorParamList, typeof SCREENS.ROOM_MEMBERS.ROOT>;

function RoomMembersPage({report, session, policies}: RoomMembersPageProps) {
    const styles = useThemeStyles();
    const {formatPhoneNumber, translate} = useLocalize();
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [removeMembersConfirmModalVisible, setRemoveMembersConfirmModalVisible] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [didLoadRoomMembers, setDidLoadRoomMembers] = useState(false);
    const personalDetails = usePersonalDetails() || CONST.EMPTY_OBJECT;
    const policy = useMemo(() => policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID ?? ''}`], [policies, report?.policyID]);
    const isPolicyExpenseChat = useMemo(() => ReportUtils.isPolicyExpenseChat(report), [report]);

    const isFocusedScreen = useIsFocused();

    const {shouldUseNarrowLayout, isSmallScreenWidth} = useResponsiveLayout();
    const [selectionMode] = useOnyx(ONYXKEYS.MOBILE_SELECTION_MODE);
    const canSelectMultiple = isSmallScreenWidth ? selectionMode?.isEnabled : true;

    useEffect(() => {
        setSearchValue(SearchInputManager.searchInput);
    }, [isFocusedScreen]);

    const shouldShowTextInput = useMemo(() => {
        if (!didLoadRoomMembers) {
            return false;
        }

        const participants = ReportUtils.getParticipantsAccountIDsForDisplay(report, true);
        return participants.length >= CONST.SHOULD_SHOW_MEMBERS_SEARCH_INPUT_BREAKPOINT;
    }, [report, didLoadRoomMembers]);

    useEffect(() => {
        if (shouldShowTextInput) {
            return;
        }

        setSearchValue('');
    }, [shouldShowTextInput]);

    useEffect(
        () => () => {
            SearchInputManager.searchInput = '';
        },
        [],
    );

    /**
     * Get members for the current room
     */
    const getRoomMembers = useCallback(() => {
        if (!report) {
            return;
        }
        Report.openRoomMembersPage(report.reportID);
        setDidLoadRoomMembers(true);
    }, [report]);

    useEffect(() => {
        getRoomMembers();
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);

    /**
     * Open the modal to invite a user
     */
    const inviteUser = useCallback(() => {
        if (!report) {
            return;
        }
        setSearchValue('');
        Navigation.navigate(ROUTES.ROOM_INVITE.getRoute(report.reportID));
    }, [report]);

    /**
     * Remove selected users from the room
     * Please see https://github.com/Expensify/App/blob/main/README.md#Security for more details
     */
    const removeUsers = () => {
        if (report) {
            Report.removeFromRoom(report.reportID, selectedMembers);
        }
        setSearchValue('');
        setSelectedMembers([]);
        setRemoveMembersConfirmModalVisible(false);
    };

    /**
     * Add user from the selectedMembers list
     */
    const addUser = useCallback((accountID: number) => {
        setSelectedMembers((prevSelected) => [...prevSelected, accountID]);
    }, []);

    /**
     * Remove user from the selectedEmployees list
     */
    const removeUser = useCallback((accountID: number) => {
        setSelectedMembers((prevSelected) => prevSelected.filter((selected) => selected !== accountID));
    }, []);

    /** Toggle user from the selectedMembers list */
    const toggleUser = useCallback(
        ({accountID, pendingAction}: ListItem) => {
            if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || !accountID) {
                return;
            }

            // Add or remove the user if the checkbox is enabled
            if (selectedMembers.includes(accountID)) {
                removeUser(accountID);
            } else {
                addUser(accountID);
            }
        },
        [selectedMembers, addUser, removeUser],
    );

    /** Add or remove all users passed from the selectedMembers list */
    const toggleAllUsers = (memberList: ListItem[]) => {
        const enabledAccounts = memberList.filter((member) => !member.isDisabled);
        const everyoneSelected = enabledAccounts.every((member) => {
            if (!member.accountID) {
                return false;
            }
            return selectedMembers.includes(member.accountID);
        });

        if (everyoneSelected) {
            setSelectedMembers([]);
        } else {
            const everyAccountId = enabledAccounts.map((member) => member.accountID).filter((accountID): accountID is number => !!accountID);
            setSelectedMembers(everyAccountId);
        }
    };

    const getMemberOptions = (): ListItem[] => {
        let result: ListItem[] = [];

        const participants = ReportUtils.getParticipantsList(report, personalDetails, true);

        participants.forEach((accountID) => {
            const details = personalDetails[accountID];

            // If search value is provided, filter out members that don't match the search value
            if (!details || (searchValue.trim() && !OptionsListUtils.isSearchStringMatchUserDetails(details, searchValue))) {
                return;
            }
            const pendingChatMember = report?.pendingChatMembers?.findLast((member) => member.accountID === accountID.toString());
            const isAdmin = !!(policy && policy.employeeList && details.login && policy.employeeList[details.login]?.role === CONST.POLICY.ROLE.ADMIN);
            const isDisabled =
                (isPolicyExpenseChat && isAdmin) ||
                accountID === session?.accountID ||
                pendingChatMember?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ||
                details.accountID === report.ownerAccountID;

            result.push({
                keyForList: String(accountID),
                accountID,
                isSelected: selectedMembers.includes(accountID),
                isDisabled,
                text: formatPhoneNumber(PersonalDetailsUtils.getDisplayNameOrDefault(details)),
                alternateText: details?.login ? formatPhoneNumber(details.login) : '',
                icons: [
                    {
                        source: details.avatar ?? Expensicons.FallbackAvatar,
                        name: details.login ?? '',
                        type: CONST.ICON_TYPE_AVATAR,
                        id: accountID,
                    },
                ],
                pendingAction: pendingChatMember?.pendingAction,
                errors: pendingChatMember?.errors,
            });
        });

        result = result.sort((value1, value2) => localeCompare(value1.text ?? '', value2.text ?? ''));

        return result;
    };

    const dismissError = useCallback(
        (item: ListItem) => {
            Report.clearAddRoomMemberError(report.reportID, String(item.accountID ?? '-1'));
        },
        [report.reportID],
    );

    const isPolicyEmployee = useMemo(() => {
        if (!report?.policyID || policies === null) {
            return false;
        }
        return PolicyUtils.isPolicyEmployee(report.policyID, policies);
    }, [report?.policyID, policies]);
    const data = getMemberOptions();
    const headerMessage = searchValue.trim() && !data.length ? translate('roomMembersPage.memberNotFound') : '';

    const bulkActionsButtonOptions = useMemo(() => {
        const options: Array<DropdownOption<RoomMemberBulkActionType>> = [
            {
                text: translate('workspace.people.removeMembersTitle'),
                value: CONST.POLICY.MEMBERS_BULK_ACTION_TYPES.REMOVE,
                icon: Expensicons.RemoveMembers,
                onSelected: () => setRemoveMembersConfirmModalVisible(true),
            },
        ];
        return options;
    }, [translate, setRemoveMembersConfirmModalVisible]);

    const headerButtons = useMemo(() => {
        return (
            <View style={styles.w100}>
                {(isSmallScreenWidth ? canSelectMultiple : selectedMembers.length > 0) ? (
                    <ButtonWithDropdownMenu<RoomMemberBulkActionType>
                        shouldAlwaysShowDropdownMenu
                        pressOnEnter
                        customText={translate('workspace.common.selected', {selectedNumber: selectedMembers.length})}
                        buttonSize={CONST.DROPDOWN_BUTTON_SIZE.MEDIUM}
                        onPress={() => null}
                        options={bulkActionsButtonOptions}
                        isSplitButton={false}
                        style={[shouldUseNarrowLayout && styles.flexGrow1]}
                        isDisabled={!selectedMembers.length}
                    />
                ) : (
                    <Button
                        medium
                        success
                        onPress={inviteUser}
                        text={translate('workspace.invite.member')}
                        icon={Expensicons.Plus}
                        innerStyles={[shouldUseNarrowLayout && styles.alignItemsCenter]}
                        style={[shouldUseNarrowLayout && styles.flexGrow1]}
                    />
                )}
            </View>
        );
    }, [bulkActionsButtonOptions, inviteUser, isSmallScreenWidth, selectedMembers, styles, translate, canSelectMultiple, shouldUseNarrowLayout]);

    /** Opens the room member details page */
    const openRoomMemberDetails = useCallback(
        (item: ListItem) => {
            Navigation.navigate(ROUTES.ROOM_MEMBER_DETAILS.getRoute(report.reportID, item?.accountID ?? -1));
        },
        [report],
    );
    const selectionModeHeader = selectionMode?.isEnabled && isSmallScreenWidth;

    const customListHeader = useMemo(() => {
        const header = (
            <View style={[styles.flex1, styles.flexRow, styles.justifyContentBetween]}>
                <View>
                    <Text style={[styles.searchInputStyle, styles.ml3]}>{translate('common.member')}</Text>
                </View>
            </View>
        );

        if (canSelectMultiple) {
            return header;
        }

        return <View style={[styles.peopleRow, styles.userSelectNone, styles.ph9, styles.pb5, styles.mt3]}>{header}</View>;
    }, [styles, translate, canSelectMultiple]);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            style={[styles.defaultModalContainer]}
            testID={RoomMembersPage.displayName}
        >
            <FullPageNotFoundView
                shouldShow={
                    isEmptyObject(report) || (!ReportUtils.isChatThread(report) && ((ReportUtils.isUserCreatedPolicyRoom(report) && !isPolicyEmployee) || ReportUtils.isDefaultRoom(report)))
                }
                subtitleKey={isEmptyObject(report) ? undefined : 'roomMembersPage.notAuthorized'}
                onBackButtonPress={() => {
                    Navigation.goBack(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report.reportID));
                }}
            >
                <HeaderWithBackButton
                    title={selectionModeHeader ? translate('common.selectMultiple') : translate('workspace.common.members')}
                    subtitle={StringUtils.lineBreaksToSpaces(ReportUtils.getReportName(report))}
                    onBackButtonPress={() => {
                        if (selectionMode?.isEnabled) {
                            setSelectedMembers([]);
                            turnOffMobileSelectionMode();
                            return;
                        }

                        setSearchValue('');
                        Navigation.goBack(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report.reportID));
                    }}
                />
                <View style={[styles.pl5, styles.pr5]}>{headerButtons}</View>
                <ConfirmModal
                    danger
                    title={translate('workspace.people.removeMembersTitle')}
                    isVisible={removeMembersConfirmModalVisible}
                    onConfirm={removeUsers}
                    onCancel={() => setRemoveMembersConfirmModalVisible(false)}
                    prompt={translate('roomMembersPage.removeMembersPrompt')}
                    confirmText={translate('common.remove')}
                    cancelText={translate('common.cancel')}
                />
                <View style={[styles.w100, styles.mt3, styles.flex1]}>
                    <SelectionListWithModal
                        canSelectMultiple={canSelectMultiple}
                        sections={[{data, isDisabled: false}]}
                        shouldShowTextInput={shouldShowTextInput}
                        textInputLabel={translate('selectionList.findMember')}
                        disableKeyboardShortcuts={removeMembersConfirmModalVisible}
                        textInputValue={searchValue}
                        onChangeText={(value) => {
                            SearchInputManager.searchInput = value;
                            setSearchValue(value);
                        }}
                        headerMessage={headerMessage}
                        turnOnSelectionModeOnLongPress
                        onTurnOnSelectionMode={(item) => item && toggleUser(item)}
                        onCheckboxPress={(item) => toggleUser(item)}
                        onSelectRow={openRoomMemberDetails}
                        onSelectAll={() => toggleAllUsers(data)}
                        showLoadingPlaceholder={!OptionsListUtils.isPersonalDetailsReady(personalDetails) || !didLoadRoomMembers}
                        showScrollIndicator
                        shouldPreventDefaultFocusOnSelectRow={!DeviceCapabilities.canUseTouchScreen()}
                        listHeaderWrapperStyle={[styles.ph9, styles.mt3]}
                        customListHeader={customListHeader}
                        ListItem={TableListItem}
                        onDismissError={dismissError}
                    />
                </View>
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

RoomMembersPage.displayName = 'RoomMembersPage';

export default withReportOrNotFound()(withCurrentUserPersonalDetails(withOnyx<RoomMembersPageProps, RoomMembersPageOnyxProps>({session: {key: ONYXKEYS.SESSION}})(RoomMembersPage)));
