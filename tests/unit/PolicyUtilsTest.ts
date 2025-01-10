/* eslint-disable @typescript-eslint/naming-convention */
import Onyx from 'react-native-onyx';
import * as PolicyUtils from '@libs/PolicyUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList, Policy, PolicyEmployeeList, Report, Transaction} from '@src/types/onyx';
import createCollection from '../utils/collections/createCollection';
import createRandomPolicy from '../utils/collections/policies';
import createRandomReport from '../utils/collections/reports';
import createRandomTransaction from '../utils/collections/transaction';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

function toLocaleDigitMock(dot: string): string {
    return dot;
}

const employeeList: PolicyEmployeeList = {
    'owner@test.com': {
        email: 'admin@test.com',
        role: 'admin',
        submitsTo: '',
    },
    'admin@test.com': {
        email: 'admin@test.com',
        role: 'admin',
        submitsTo: '',
    },
    'employee@test.com': {
        email: 'employee@test.com',
        role: 'user',
        submitsTo: 'admin@test.com',
    },
    'categoryapprover1@test.com': {
        email: 'categoryapprover1@test.com',
        role: 'user',
        submitsTo: 'admin@test.com',
    },
    'categoryapprover2@test.com': {
        email: 'categoryapprover2@test.com',
        role: 'user',
        submitsTo: 'admin@test.com',
    },
    'tagapprover1@test.com': {
        email: 'tagapprover1@test.com',
        role: 'user',
        submitsTo: 'admin@test.com',
    },
    'tagapprover2@test.com': {
        email: 'tagapprover2@test.com',
        role: 'user',
        submitsTo: 'admin@test.com',
    },
};

const personalDetails: PersonalDetailsList = {
    '1': {
        accountID: 1,
        login: 'admin@test.com',
    },
    '2': {
        accountID: 2,
        login: 'employee@test.com',
    },
    '3': {
        accountID: 3,
        login: 'categoryapprover1@test.com',
    },
    '4': {
        accountID: 4,
        login: 'categoryapprover2@test.com',
    },
    '5': {
        accountID: 5,
        login: 'tagapprover1@test.com',
    },
    '6': {
        accountID: 6,
        login: 'tagapprover2@test.com',
    },
    '7': {
        accountID: 7,
        login: 'owner@test.com',
    },
};

const rules = {
    approvalRules: [
        {
            applyWhen: [
                {
                    condition: 'matches',
                    field: 'category',
                    value: 'cat1',
                },
            ],
            approver: 'categoryapprover1@test.com',
            id: '1',
        },
        {
            applyWhen: [
                {
                    condition: 'matches',
                    field: 'tag',
                    value: 'tag1',
                },
            ],
            approver: 'tagapprover1@test.com',
            id: '2',
        },
        {
            applyWhen: [
                {
                    condition: 'matches',
                    field: 'category',
                    value: 'cat2',
                },
            ],
            approver: 'categoryapprover2@test.com',
            id: '3',
        },
        {
            applyWhen: [
                {
                    condition: 'matches',
                    field: 'tag',
                    value: 'tag2',
                },
            ],
            approver: 'tagapprover2@test.com',
            id: '4',
        },
    ],
};

const ownerAccountID = 7;
const adminAccountID = 1;
const employeeAccountID = 2;
const categoryapprover1AccountID = 3;
const categoryapprover2AccountID = 4;
const tagapprover1AccountID = 5;
const tagapprover2AccountID = 6;

describe('PolicyUtils', () => {
    describe('getActivePolicies', () => {
        it("getActivePolicies should filter out policies that the current user doesn't belong to", () => {
            const policies = createCollection<Policy>(
                (item) => `${ONYXKEYS.COLLECTION.POLICY}${item.id}`,
                (index) => ({...createRandomPolicy(index + 1), name: 'workspace', pendingAction: null, ...(!index && {role: null})} as Policy),
                2,
            );
            expect(PolicyUtils.getActivePolicies(policies, undefined)).toHaveLength(1);
        });
    });
    describe('getRateDisplayValue', () => {
        it('should return an empty string for NaN', () => {
            const rate = PolicyUtils.getRateDisplayValue('invalid' as unknown as number, toLocaleDigitMock);
            expect(rate).toEqual('');
        });

        describe('withDecimals = false', () => {
            it('should return integer value as is', () => {
                const rate = PolicyUtils.getRateDisplayValue(100, toLocaleDigitMock);
                expect(rate).toEqual('100');
            });

            it('should return non-integer value as is', () => {
                const rate = PolicyUtils.getRateDisplayValue(10.5, toLocaleDigitMock);
                expect(rate).toEqual('10.5');
            });
        });

        describe('withDecimals = true', () => {
            it('should return integer value with 2 trailing zeros', () => {
                const rate = PolicyUtils.getRateDisplayValue(10, toLocaleDigitMock, true);
                expect(rate).toEqual('10.00');
            });

            it('should return non-integer value with up to 2 trailing zeros', () => {
                const rate = PolicyUtils.getRateDisplayValue(10.5, toLocaleDigitMock, true);
                expect(rate).toEqual('10.50');
            });

            it('should return non-integer value with 4 decimals as is', () => {
                const rate = PolicyUtils.getRateDisplayValue(10.5312, toLocaleDigitMock, true);
                expect(rate).toEqual('10.5312');
            });

            it('should return non-integer value with 3 decimals as is', () => {
                const rate = PolicyUtils.getRateDisplayValue(10.531, toLocaleDigitMock, true);
                expect(rate).toEqual('10.531');
            });

            it('should return non-integer value with 4+ decimals cut to 4', () => {
                const rate = PolicyUtils.getRateDisplayValue(10.53135, toLocaleDigitMock, true);
                expect(rate).toEqual('10.5313');
            });
        });
    });

    describe('getUnitRateValue', () => {
        it('should return an empty string for NaN', () => {
            const rate = PolicyUtils.getUnitRateValue(toLocaleDigitMock, {rate: 'invalid' as unknown as number});
            expect(rate).toEqual('');
        });

        describe('withDecimals = false', () => {
            it('should return value divisible by 100 with no decimal places', () => {
                const rate = PolicyUtils.getUnitRateValue(toLocaleDigitMock, {rate: 100});
                expect(rate).toEqual('1');
            });

            it('should return non-integer value as is divided by 100', () => {
                const rate = PolicyUtils.getUnitRateValue(toLocaleDigitMock, {rate: 11.11});
                expect(rate).toEqual('0.1111');
            });
        });

        describe('withDecimals = true', () => {
            it('should return value divisible by 100 with 2 decimal places', () => {
                const rate = PolicyUtils.getUnitRateValue(toLocaleDigitMock, {rate: 100}, true);
                expect(rate).toEqual('1.00');
            });

            it('should return non-integer value as is divided by 100', () => {
                const rate = PolicyUtils.getUnitRateValue(toLocaleDigitMock, {rate: 11.11}, true);
                expect(rate).toEqual('0.1111');
            });
        });
    });

    describe('getSubmitToAccountID', () => {
        beforeEach(() => {
            Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, personalDetails);
            return waitForBatchedUpdates();
        });
        afterEach(() => {
            Onyx.clear();
        });
        describe('Has no rule approver', () => {
            it('should return the policy approver/owner if the policy use the optional or basic workflow', () => {
                const policy: Policy = {
                    ...createRandomPolicy(0),
                    approver: 'owner@test.com',
                    owner: 'owner@test.com',
                    type: 'team',
                    approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC,
                };
                const expenseReport: Report = {
                    ...createRandomReport(0),
                    ownerAccountID: employeeAccountID,
                    type: CONST.REPORT.TYPE.EXPENSE,
                };
                expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(ownerAccountID);
            });
            it('should return the employee submitsTo if the policy use the advance workflow', () => {
                const policy: Policy = {
                    ...createRandomPolicy(0),
                    approver: 'owner@test.com',
                    owner: 'owner@test.com',
                    employeeList,
                    type: 'team',
                    approvalMode: CONST.POLICY.APPROVAL_MODE.ADVANCED,
                };
                const expenseReport: Report = {
                    ...createRandomReport(0),
                    ownerAccountID: employeeAccountID,
                    type: CONST.REPORT.TYPE.EXPENSE,
                };
                expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(adminAccountID);
            });
        });
        describe('Has category/tag approver', () => {
            it('should return the first category approver if has any transaction category match with category approver rule', () => {
                const policy: Policy = {
                    ...createRandomPolicy(0),
                    approver: 'owner@test.com',
                    owner: 'owner@test.com',
                    type: 'team',
                    employeeList,
                    rules,
                };
                const expenseReport: Report = {
                    ...createRandomReport(0),
                    ownerAccountID: employeeAccountID,
                    type: CONST.REPORT.TYPE.EXPENSE,
                };
                const transaction1: Transaction = {
                    ...createRandomTransaction(0),
                    category: 'cat1',
                    reportID: expenseReport.reportID,
                };
                const transaction2: Transaction = {
                    ...createRandomTransaction(1),
                    category: '',
                    reportID: expenseReport.reportID,
                };
                Onyx.set(ONYXKEYS.COLLECTION.TRANSACTION, {
                    [transaction1.transactionID]: transaction1,
                    [transaction2.transactionID]: transaction2,
                }).then(() => {
                    expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(categoryapprover1AccountID);
                });
            });
            it('should return the category approver of the first transaction sorted by created if we have many transaction categories match with the category approver rule', () => {
                const policy: Policy = {
                    ...createRandomPolicy(0),
                    approver: 'owner@test.com',
                    owner: 'owner@test.com',
                    type: 'team',
                    employeeList,
                    rules,
                };
                const expenseReport: Report = {
                    ...createRandomReport(0),
                    ownerAccountID: employeeAccountID,
                    type: CONST.REPORT.TYPE.EXPENSE,
                };
                const transaction1: Transaction = {
                    ...createRandomTransaction(0),
                    category: 'cat1',
                    created: '3',
                    reportID: expenseReport.reportID,
                };
                const transaction2: Transaction = {
                    ...createRandomTransaction(1),
                    category: 'cat2',
                    created: '2',
                    reportID: expenseReport.reportID,
                };
                Onyx.set(ONYXKEYS.COLLECTION.TRANSACTION, {
                    [transaction1.transactionID]: transaction1,
                    [transaction2.transactionID]: transaction2,
                }).then(() => {
                    expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(categoryapprover2AccountID);
                });
            });
            describe('Has no transaction match with the category approver rule', () => {
                it('should return the first tag approver if has any transaction tag match with with the tag approver rule ', () => {
                    const policy: Policy = {
                        ...createRandomPolicy(0),
                        approver: 'owner@test.com',
                        owner: 'owner@test.com',
                        type: 'team',
                        employeeList,
                        rules,
                    };
                    const expenseReport: Report = {
                        ...createRandomReport(0),
                        ownerAccountID: employeeAccountID,
                        type: CONST.REPORT.TYPE.EXPENSE,
                    };
                    const transaction1: Transaction = {
                        ...createRandomTransaction(0),
                        category: '',
                        tag: 'tag1',
                        created: '3',
                        reportID: expenseReport.reportID,
                    };
                    const transaction2: Transaction = {
                        ...createRandomTransaction(1),
                        category: '',
                        tag: '',
                        created: '2',
                        reportID: expenseReport.reportID,
                    };
                    Onyx.set(ONYXKEYS.COLLECTION.TRANSACTION, {
                        [transaction1.transactionID]: transaction1,
                        [transaction2.transactionID]: transaction2,
                    }).then(() => {
                        expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(tagapprover1AccountID);
                    });
                });
                it('should return the tag approver of the first transaction sorted by created if we have many transaction tags match with the tag approver rule', () => {
                    const policy: Policy = {
                        ...createRandomPolicy(0),
                        approver: 'owner@test.com',
                        owner: 'owner@test.com',
                        type: 'team',
                        employeeList,
                        rules,
                    };
                    const expenseReport: Report = {
                        ...createRandomReport(0),
                        ownerAccountID: employeeAccountID,
                        type: CONST.REPORT.TYPE.EXPENSE,
                    };
                    const transaction1: Transaction = {
                        ...createRandomTransaction(0),
                        category: '',
                        tag: 'tag1',
                        created: '3',
                        reportID: expenseReport.reportID,
                    };
                    const transaction2: Transaction = {
                        ...createRandomTransaction(1),
                        category: '',
                        tag: 'tag2',
                        created: '2',
                        reportID: expenseReport.reportID,
                    };
                    Onyx.set(ONYXKEYS.COLLECTION.TRANSACTION, {
                        [transaction1.transactionID]: transaction1,
                        [transaction2.transactionID]: transaction2,
                    }).then(() => {
                        expect(PolicyUtils.getSubmitToAccountID(policy, expenseReport)).toBe(tagapprover2AccountID);
                    });
                });
            });
        });
    });
});
