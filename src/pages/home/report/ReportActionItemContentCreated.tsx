import lodashIsEqual from 'lodash/isEqual';
import React, {memo, useMemo} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import RenderHTML from '@components/RenderHTML';
import MoneyReportView from '@components/ReportActionItem/MoneyReportView';
import MoneyRequestView from '@components/ReportActionItem/MoneyRequestView';
import TaskView from '@components/ReportActionItem/TaskView';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import type {ShowContextMenuContextProps} from '@components/ShowContextMenuContext';
import SpacerView from '@components/SpacerView';
import UnreadActionIndicator from '@components/UnreadActionIndicator';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import AnimatedEmptyStateBackground from './AnimatedEmptyStateBackground';
import ReportActionItemCreated from './ReportActionItemCreated';
import ReportActionItemSingle from './ReportActionItemSingle';

type ReportActionItemProps = {
    /**  The context value containing the report and action data, along with the show context menu props */
    contextValue: ShowContextMenuContextProps & {
        report: OnyxTypes.Report;
        action: OnyxTypes.ReportAction;
    };

    /** Report action belonging to the report's parent */
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;

    /** The transaction ID */
    transactionID: string | undefined;

    /** The draft message */
    draftMessage: string | undefined;

    /** Flag to show, hide the thread divider line */
    shouldHideThreadDividerLine: boolean;
};

function ReportActionItemContentCreated({contextValue, parentReportAction, transactionID, draftMessage, shouldHideThreadDividerLine}: ReportActionItemProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${contextValue.report.policyID ?? 0}`);
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`);

    const transactionCurrency = TransactionUtils.getCurrency(transaction);

    const renderThreadDivider = useMemo(
        () =>
            shouldHideThreadDividerLine ? (
                <UnreadActionIndicator
                    reportActionID={contextValue.report.reportID ?? ''}
                    shouldHideThreadDividerLine={shouldHideThreadDividerLine}
                />
            ) : (
                <SpacerView
                    shouldShow={!shouldHideThreadDividerLine}
                    style={[!shouldHideThreadDividerLine ? styles.reportHorizontalRule : {}]}
                />
            ),
        [shouldHideThreadDividerLine, contextValue.report.reportID, styles.reportHorizontalRule],
    );

    if (ReportActionsUtils.isTransactionThread(parentReportAction)) {
        const isReversedTransaction = ReportActionsUtils.isReversedTransaction(parentReportAction);

        if (ReportActionsUtils.isDeletedParentAction(parentReportAction) || isReversedTransaction) {
            let message: TranslationPaths;

            if (isReversedTransaction) {
                message = 'parentReportAction.reversedTransaction';
            } else {
                message = 'parentReportAction.deletedExpense';
            }

            return (
                <View style={[styles.pRelative]}>
                    <AnimatedEmptyStateBackground />
                    <OfflineWithFeedback pendingAction={parentReportAction?.pendingAction ?? null}>
                        <ReportActionItemSingle
                            action={parentReportAction}
                            showHeader
                            report={contextValue.report}
                        >
                            <RenderHTML html={`<comment>${translate(message)}</comment>`} />
                        </ReportActionItemSingle>
                        <View style={styles.threadDividerLine} />
                    </OfflineWithFeedback>
                </View>
            );
        }

        return (
            <ShowContextMenuContext.Provider value={contextValue}>
                <View>
                    <MoneyRequestView
                        report={contextValue.report}
                        shouldShowAnimatedBackground
                    />
                    {renderThreadDivider}
                </View>
            </ShowContextMenuContext.Provider>
        );
    }

    if (ReportUtils.isTaskReport(contextValue.report)) {
        if (ReportUtils.isCanceledTaskReport(contextValue.report, parentReportAction)) {
            return (
                <View style={[styles.pRelative]}>
                    <AnimatedEmptyStateBackground />
                    <OfflineWithFeedback pendingAction={parentReportAction?.pendingAction}>
                        <ReportActionItemSingle
                            action={parentReportAction}
                            showHeader={draftMessage === undefined}
                            report={contextValue.report}
                        >
                            <RenderHTML html={`<comment>${translate('parentReportAction.deletedTask')}</comment>`} />
                        </ReportActionItemSingle>
                    </OfflineWithFeedback>
                    <View style={styles.reportHorizontalRule} />
                </View>
            );
        }

        return (
            <View style={[styles.pRelative]}>
                <AnimatedEmptyStateBackground />
                <View>
                    <TaskView report={contextValue.report} />
                    {renderThreadDivider}
                </View>
            </View>
        );
    }

    if (ReportUtils.isExpenseReport(contextValue.report) || ReportUtils.isIOUReport(contextValue.report) || ReportUtils.isInvoiceReport(contextValue.report)) {
        return (
            <OfflineWithFeedback pendingAction={contextValue.action.pendingAction}>
                {contextValue.transactionThreadReport && !isEmptyObject(contextValue.transactionThreadReport) ? (
                    <>
                        {transactionCurrency !== contextValue.report.currency && (
                            <>
                                <MoneyReportView
                                    report={contextValue.report}
                                    policy={policy}
                                />
                                {renderThreadDivider}
                            </>
                        )}
                        <ShowContextMenuContext.Provider value={contextValue}>
                            <View>
                                <MoneyRequestView
                                    report={contextValue.transactionThreadReport}
                                    shouldShowAnimatedBackground={transactionCurrency === contextValue.report.currency}
                                />
                                {renderThreadDivider}
                            </View>
                        </ShowContextMenuContext.Provider>
                    </>
                ) : (
                    <>
                        <MoneyReportView
                            report={contextValue.report}
                            policy={policy}
                        />
                        {renderThreadDivider}
                    </>
                )}
            </OfflineWithFeedback>
        );
    }

    return (
        <ReportActionItemCreated
            reportID={contextValue.report.reportID}
            policyID={contextValue.report.policyID}
        />
    );
}

ReportActionItemContentCreated.displayName = 'ReportActionItemContentCreated';

export default memo(
    ReportActionItemContentCreated,
    (prevProps, nextProps) =>
        lodashIsEqual(prevProps.contextValue, nextProps.contextValue) &&
        lodashIsEqual(prevProps.parentReportAction, nextProps.parentReportAction) &&
        prevProps.transactionID === nextProps.transactionID &&
        prevProps.draftMessage === nextProps.draftMessage &&
        prevProps.shouldHideThreadDividerLine === nextProps.shouldHideThreadDividerLine,
);
