import type {TransactionListItemType} from '@components/SelectionList/types';
import CONST from '@src/CONST';
import * as SearchUIUtils from '@src/libs/SearchUIUtils';
import type * as OnyxTypes from '@src/types/onyx';

const fakeAccountID = 18439984;
const fakePolicyID = 'A1B2C3';
const fakeReportID = '123456789';
const fakeTransactionID = '1';

const fakeSearchResults: OnyxTypes.SearchResults = {
    data: {
        personalDetailsList: {
            [fakeAccountID]: {
                accountID: fakeAccountID,
                avatar: 'https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_3.png',
                displayName: 'test',
                login: 'test1234@gmail.com',
            },
        },
        [`policy_${fakePolicyID}`]: {
            approvalMode: 'OPTIONAL',
            autoReimbursement: {
                limit: 0,
            },
            autoReimbursementLimit: 0,
            autoReporting: true,
            autoReportingFrequency: 'instant',
            preventSelfApproval: false,
            owner: 'test1234@gmail.com',
            reimbursementChoice: 'reimburseManual',
            role: 'admin',
            type: 'team',
        },
        [`report_${fakeReportID}`]: {
            accountID: fakeAccountID,
            action: 'view',
            chatReportID: '1706144653204915',
            created: '2024-12-21 13:05:20',
            currency: 'USD',
            isOneTransactionReport: true,
            isPolicyExpenseChat: false,
            isWaitingOnBankAccount: false,
            managerID: fakeAccountID,
            nonReimbursableTotal: 0,
            ownerAccountID: fakeAccountID,
            policyID: fakePolicyID,
            reportID: fakeReportID,
            reportName: 'Expense Report #123',
            stateNum: 1,
            statusNum: 1,
            total: -5000,
            type: 'expense',
            unheldTotal: -5000,
        },
        [`transactions_${fakeTransactionID}`]: {
            accountID: fakeAccountID,
            action: 'view',
            amount: -5000,
            canDelete: true,
            canHold: true,
            canUnhold: false,
            category: '',
            comment: {
                comment: '',
            },
            created: '2024-12-21',
            currency: 'USD',
            hasEReceipt: false,
            isFromOneTransactionReport: true,
            managerID: fakeAccountID,
            description: '',
            hasViolation: false,
            merchant: 'Expense',
            modifiedAmount: 0,
            modifiedCreated: '',
            modifiedCurrency: '',
            modifiedMerchant: 'Expense',
            parentTransactionID: '',
            policyID: fakePolicyID,
            reportID: fakeReportID,
            reportType: 'expense',
            tag: '',
            transactionID: fakeTransactionID,
            transactionThreadReportID: '456',
            transactionType: 'cash',
        },
    },
    search: {
        columnsToShow: {
            shouldShowCategoryColumn: true,
            shouldShowTagColumn: false,
            shouldShowTaxColumn: false,
        },
        hasMoreResults: false,
        hasResults: true,
        offset: 0,
        status: 'all',
        isLoading: false,
        type: 'expense',
    },
};
const transactionSections = SearchUIUtils.getSections('expense', 'all', fakeSearchResults.data, fakeSearchResults.search) as TransactionListItemType[];
const tests = transactionSections.map((transactionList) => [{transactionListItem: transactionList, expectedMerchant: CONST.TRANSACTION.DEFAULT_MERCHANT}]);

describe('SearchUIUtils', () => {
    test.each(tests)('Transaction list item with "Expense" merchant', ({transactionListItem, expectedMerchant}) => {
        expect(transactionListItem.merchant).toEqual(expectedMerchant);
    });
});
