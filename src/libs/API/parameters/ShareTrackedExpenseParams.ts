import type {Receipt} from '@src/types/onyx/Transaction';

type ShareTrackedExpenseParams = {
    amount: number;
    currency: string;
    comment: string;
    created: string;
    merchant: string;
    policyID: string | undefined;
    transactionID: string | undefined;
    moneyRequestPreviewReportActionID: string | undefined;
    moneyRequestReportID: string | undefined;
    moneyRequestCreatedReportActionID: string | undefined;
    actionableWhisperReportActionID: string;
    modifiedExpenseReportActionID: string;
    reportPreviewReportActionID: string | undefined;
    category?: string;
    tag?: string;
    receipt?: Receipt;
    taxCode: string;
    taxAmount: number;
    billable?: boolean;
    waypoints?: string;
    customUnitRateID?: string;
    policyExpenseChatReportID?: string;
    policyExpenseCreatedReportActionID?: string;
    adminsChatReportID?: string;
    adminsCreatedReportActionID?: string;
    engagementChoice?: string;
    guidedSetupData?: string;
};

export default ShareTrackedExpenseParams;
