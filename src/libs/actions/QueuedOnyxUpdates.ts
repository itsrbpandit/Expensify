import type {OnyxKey, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';

// In this file we manage a queue of Onyx updates while the SequentialQueue is processing. There are functions to get the updates and clear the queue after saving the updates in Onyx.

let queuedOnyxUpdates: OnyxUpdate[] = [];
let currentAccountID: number | undefined;

/**
 * isPreservedKeysFilterEnabled is a flag used in flushQueue unit tests to mock and control whether the preserved keys filtering logic executes.
 */
const isPreservedKeysFilterEnabled = false;

Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (session) => {
        currentAccountID = session?.accountID;
    },
});

/**
 * @param updates Onyx updates to queue for later
 */
function queueOnyxUpdates(updates: OnyxUpdate[]): Promise<void> {
    queuedOnyxUpdates = queuedOnyxUpdates.concat(updates);
    return Promise.resolve();
}

function flushQueue(): Promise<void> {
    if (!currentAccountID && (!CONFIG.IS_TEST_ENV || isPreservedKeysFilterEnabled)) {
        const preservedKeys: OnyxKey[] = [
            ONYXKEYS.NVP_TRY_FOCUS_MODE,
            ONYXKEYS.PREFERRED_THEME,
            ONYXKEYS.NVP_PREFERRED_LOCALE,
            ONYXKEYS.SESSION,
            ONYXKEYS.IS_LOADING_APP,
            ONYXKEYS.CREDENTIALS,
            ONYXKEYS.IS_SIDEBAR_LOADED,
        ];

        queuedOnyxUpdates = queuedOnyxUpdates.filter((update) => preservedKeys.includes(update.key as OnyxKey));
    }

    return Onyx.update(queuedOnyxUpdates).then(() => {
        queuedOnyxUpdates = [];
    });
}

function isEmpty() {
    return queuedOnyxUpdates.length === 0;
}

export {queueOnyxUpdates, flushQueue, isEmpty};
