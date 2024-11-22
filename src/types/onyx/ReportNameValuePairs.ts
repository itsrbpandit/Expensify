import type ONYXKEYS from '@src/ONYXKEYS';
import type CollectionDataSet from '@src/types/utils/CollectionDataSet';
import type * as OnyxCommon from './OnyxCommon';

/** Model of additional report details */
type ReportNameValuePairs = OnyxCommon.OnyxValueWithOfflineFeedback<{
    /** Whether the report is an archived room */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private_isArchived: boolean;
}>;

/** Collection of reportNameValuePairs, indexed by reportNameValuePairs_{reportID} */
type ReportNameValuePairsCollectionDataSet = CollectionDataSet<typeof ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS>;

export default ReportNameValuePairs;

export type {ReportNameValuePairsCollectionDataSet};
