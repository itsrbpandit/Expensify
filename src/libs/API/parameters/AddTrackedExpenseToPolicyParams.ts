import type {Receipt} from '@src/types/onyx/Transaction';

type AddTrackedExpenseToPolicyParams = {
    amount: number;
    currency: string;
    created: string;
    comment?: string;
    merchant?: string;
    category: string | undefined;
    tag: string | undefined;
    taxCode: string;
    taxAmount: number;
    billable: boolean | undefined;
    policyID: string;
    transactionID: string;
    actionableWhisperReportActionID: string;
    moneyRequestReportID: string;
    reportPreviewReportActionID: string;
    modifiedExpenseReportActionID: string;
    moneyRequestCreatedReportActionID: string | undefined;
    moneyRequestPreviewReportActionID: string;
    receipt: Receipt | undefined;
};

export default AddTrackedExpenseToPolicyParams;
