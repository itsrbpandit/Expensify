import type {TupleToUnion} from 'type-fest';
import CONST from '@src/CONST';
import ACTION_FORM_INPUT_IDS from '@src/types/form/DebugReportActionForm';
import REPORT_FORM_INPUT_IDS from '@src/types/form/DebugReportForm';

const DETAILS_CONSTANT_OPTIONS = {
    chatType: CONST.REPORT.CHAT_TYPE,
    currency: CONST.CURRENCY,
    notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE,
    type: CONST.REPORT.TYPE,
    writeCapability: CONST.REPORT.WRITE_CAPABILITIES,
    lastActionType: CONST.REPORT.ACTIONS.TYPE,
    actionName: CONST.REPORT.ACTIONS.TYPE,
};

const LAST_ACTION_TYPE = 'lastActionType';
const ACTION_NAME = 'actionName';

const DETAILS_CONSTANT_FIELDS = [
    ACTION_FORM_INPUT_IDS.ACTION_NAME,
    REPORT_FORM_INPUT_IDS.CHAT_TYPE,
    REPORT_FORM_INPUT_IDS.CURRENCY,
    REPORT_FORM_INPUT_IDS.NOTIFICATION_PREFERENCE,
    REPORT_FORM_INPUT_IDS.TYPE,
    REPORT_FORM_INPUT_IDS.LAST_ACTION_TYPE,
    REPORT_FORM_INPUT_IDS.WRITE_CAPABILITY,
];

const DETAILS_DATETIME_FIELDS = [
    ACTION_FORM_INPUT_IDS.CREATED,
    ACTION_FORM_INPUT_IDS.LAST_MODIFIED,
    REPORT_FORM_INPUT_IDS.LAST_READ_TIME,
    REPORT_FORM_INPUT_IDS.LAST_VISIBLE_ACTION_CREATED,
    REPORT_FORM_INPUT_IDS.LAST_VISIBLE_ACTION_LAST_MODIFIED,
];

// TODO: Create TRANSACTION_FORM_INPUT_IDS
const DETAILS_DISABLED_KEYS = [ACTION_FORM_INPUT_IDS.REPORT_ACTION_ID, REPORT_FORM_INPUT_IDS.REPORT_ID, REPORT_FORM_INPUT_IDS.POLICY_ID, 'transactionID'];

type DetailsConstantFieldsKeys = TupleToUnion<typeof DETAILS_CONSTANT_FIELDS>;

type DetailsDatetimeFieldsKeys = TupleToUnion<typeof DETAILS_DATETIME_FIELDS>;
type DetailsDisabledKeys = TupleToUnion<typeof DETAILS_DISABLED_KEYS>;

export type {DetailsConstantFieldsKeys, DetailsDatetimeFieldsKeys, DetailsDisabledKeys};
export {DETAILS_CONSTANT_OPTIONS, LAST_ACTION_TYPE, ACTION_NAME, DETAILS_CONSTANT_FIELDS, DETAILS_DATETIME_FIELDS, DETAILS_DISABLED_KEYS};
