import React from 'react';
import {ActivityIndicator, InteractionManager, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import FullPageOfflineBlockingView from '@components/BlockingViews/FullPageOfflineBlockingView';
import Button from '@components/Button';
import DestinationPicker from '@components/DestinationPicker';
import FixedFooter from '@components/FixedFooter';
import * as Illustrations from '@components/Icon/Illustrations';
import type {ListItem} from '@components/SelectionList/types';
import WorkspaceEmptyStateSection from '@components/WorkspaceEmptyStateSection';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import usePermissions from '@hooks/usePermissions';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import StepScreenWrapper from './StepScreenWrapper';
import type {WithFullTransactionOrNotFoundProps} from './withFullTransactionOrNotFound';
import withFullTransactionOrNotFound from './withFullTransactionOrNotFound';
import type {WithWritableReportOrNotFoundProps} from './withWritableReportOrNotFound';
import withWritableReportOrNotFound from './withWritableReportOrNotFound';
import * as ReportUtils from '@libs/ReportUtils';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';

type IOURequestStepDestinationProps = WithWritableReportOrNotFoundProps<typeof SCREENS.MONEY_REQUEST.STEP_DESTINATION | typeof SCREENS.MONEY_REQUEST.CREATE> &
    WithFullTransactionOrNotFoundProps<typeof SCREENS.MONEY_REQUEST.STEP_DESTINATION | typeof SCREENS.MONEY_REQUEST.CREATE> & {
        openedFromStartPage?: boolean;
        explictPolicyID?: string;
    };

function IOURequestStepDestination({
    report,
    route: {
        params: {transactionID, backTo, action, iouType, reportID},
    },
    transaction,
    openedFromStartPage = false,
    explictPolicyID,
}: IOURequestStepDestinationProps) {
    const [policy, policyMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${explictPolicyID ?? IOU.getIOURequestPolicyID(transaction, report)}`);
    const {accountID} = useCurrentUserPersonalDetails();
    const policyExpenseReport = ReportUtils.getPolicyExpenseChat(accountID, policy?.id ?? '-1');

    const customUnit = PolicyUtils.getPerDiemCustomUnit(policy);
    const selectedDestination = transaction?.comment?.customUnit?.customUnitRateID;

    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const {canUseCombinedTrackSubmit} = usePermissions();

    // eslint-disable-next-line rulesdir/no-negated-variables
    const shouldShowNotFoundPage = isEmptyObject(policy);

    const {isOffline} = useNetwork();
    const isLoading = !isOffline && isLoadingOnyxValue(policyMetadata);
    const shouldShowEmptyState = isEmptyObject(customUnit?.rates);
    const shouldShowOfflineView = isEmptyObject(customUnit?.rates) && isOffline;

    const navigateBack = () => {
        Navigation.goBack(backTo);
    };

    const updateDestination = (destination: ListItem) => {
        if (openedFromStartPage) {
            IOU.setMoneyRequestParticipantsFromReport(transactionID, policyExpenseReport);
        }
        IOU.setCustomUnitRateID(transactionID, destination.keyForList ?? '');

        if (backTo) {
            navigateBack();
        } else {
            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_TIME.getRoute(action, iouType, transactionID, policyExpenseReport?.reportID ?? reportID));
        }
    };

    const tabTitles = {
        [CONST.IOU.TYPE.REQUEST]: translate('iou.createExpense'),
        [CONST.IOU.TYPE.SUBMIT]: canUseCombinedTrackSubmit ? translate('iou.createExpense') : translate('iou.submitExpense'),
        [CONST.IOU.TYPE.SEND]: translate('iou.paySomeone', {name: ''}),
        [CONST.IOU.TYPE.PAY]: translate('iou.paySomeone', {name: ''}),
        [CONST.IOU.TYPE.SPLIT]: translate('iou.createExpense'),
        [CONST.IOU.TYPE.TRACK]: canUseCombinedTrackSubmit ? translate('iou.createExpense') : translate('iou.trackExpense'),
        [CONST.IOU.TYPE.INVOICE]: translate('workspace.invoices.sendInvoice'),
        [CONST.IOU.TYPE.CREATE]: translate('iou.createExpense'),
    };

    return (
        <StepScreenWrapper
            headerTitle={backTo ? translate('common.destination') : tabTitles[iouType]}
            onBackButtonPress={navigateBack}
            shouldShowWrapper={!openedFromStartPage}
            shouldShowNotFoundPage={shouldShowNotFoundPage}
            testID={IOURequestStepDestination.displayName}
        >
            {isLoading && (
                <ActivityIndicator
                    size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                    style={[styles.flex1]}
                    color={theme.spinner}
                />
            )}
            {shouldShowOfflineView && <FullPageOfflineBlockingView>{null}</FullPageOfflineBlockingView>}
            {shouldShowEmptyState && (
                <View style={[styles.flex1]}>
                    <WorkspaceEmptyStateSection
                        shouldStyleAsCard={false}
                        icon={Illustrations.EmptyStateExpenses}
                        title={translate('workspace.perDiem.emptyList.title')}
                        subtitle={translate('workspace.perDiem.emptyList.subtitle')}
                        containerStyle={[styles.flex1, styles.justifyContentCenter]}
                    />
                    {PolicyUtils.isPolicyAdmin(policy) && !!policy?.areCategoriesEnabled && (
                        <FixedFooter style={[styles.mtAuto, styles.pt5]}>
                            <Button
                                large
                                success
                                style={[styles.w100]}
                                onPress={() => {
                                    InteractionManager.runAfterInteractions(() => {
                                        Navigation.navigate(ROUTES.WORKSPACE_PER_DIEM.getRoute(policy?.id ?? '-1'));
                                    });
                                }}
                                text={translate('workspace.categories.editCategories')}
                                pressOnEnter
                            />
                        </FixedFooter>
                    )}
                </View>
            )}
            {!shouldShowEmptyState && !isLoading && !shouldShowOfflineView && (
                <DestinationPicker
                    selectedDestination={selectedDestination}
                    policyID={report?.policyID ?? policy?.id ?? '-1'}
                    onSubmit={updateDestination}
                />
            )}
        </StepScreenWrapper>
    );
}

IOURequestStepDestination.displayName = 'IOURequestStepDestination';

/* eslint-disable rulesdir/no-negated-variables */
const IOURequestStepDestinationWithFullTransactionOrNotFound = withFullTransactionOrNotFound(IOURequestStepDestination);
/* eslint-disable rulesdir/no-negated-variables */
const IOURequestStepDestinationWithWritableReportOrNotFound = withWritableReportOrNotFound(IOURequestStepDestinationWithFullTransactionOrNotFound);
export default IOURequestStepDestinationWithWritableReportOrNotFound;
