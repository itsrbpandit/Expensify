import {Platform} from 'react-native';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import alert from '@components/Alert';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {RequestType} from '@src/types/onyx/Request';
import type Response from '@src/types/onyx/Response';
import * as NetworkActions from './actions/Network';
import * as UpdateRequired from './actions/UpdateRequired';
import {READ_COMMANDS, SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from './API/types';
import * as ApiUtils from './ApiUtils';
import HttpsError from './Errors/HttpsError';

let shouldFailAllRequests = false;
let shouldForceOffline = false;

const ABORT_COMMANDS = {
    All: 'All',
    [READ_COMMANDS.SEARCH_FOR_REPORTS]: READ_COMMANDS.SEARCH_FOR_REPORTS,
} as const;

type AbortCommand = keyof typeof ABORT_COMMANDS;

Onyx.connect({
    key: ONYXKEYS.NETWORK,
    callback: (network) => {
        if (!network) {
            return;
        }
        shouldFailAllRequests = !!network.shouldFailAllRequests;
        shouldForceOffline = !!network.shouldForceOffline;
    },
});

// We use the AbortController API to terminate pending request in `cancelPendingRequests`
const abortControllerMap = new Map<AbortCommand, AbortController>();
abortControllerMap.set(ABORT_COMMANDS.All, new AbortController());
abortControllerMap.set(ABORT_COMMANDS.SearchForReports, new AbortController());

/**
 * The API commands that require the skew calculation
 */
const addSkewList: string[] = [SIDE_EFFECT_REQUEST_COMMANDS.OPEN_REPORT, SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP, WRITE_COMMANDS.OPEN_APP];

/**
 * Regex to get API command from the command
 */
const APICommandRegex = /\/api\/([^&?]+)\??.*/;

/**
 * Send an HTTP request, and attempt to resolve the json response.
 * If there is a network error, we'll set the application offline.
 */
function processHTTPRequest(url: string, method: RequestType = 'get', body: FormData | null = null, abortSignal: AbortSignal | undefined = undefined): Promise<Response> {
    const startTime = new Date().valueOf();
    return fetch(url, {
        // We hook requests to the same Controller signal, so we can cancel them all at once
        signal: abortSignal,
        method,
        body,
        // On Web fetch already defaults to 'omit' for credentials, but it seems that this is not the case for the ReactNative implementation
        // so to avoid sending cookies with the request we set it to 'omit' explicitly
        // this avoids us sending specially the expensifyWeb cookie, which makes a CSRF token required
        // more on that here: https://stackoverflowteams.com/c/expensify/questions/93
        credentials: 'omit',
    })
        .then((response) => {
            // We are calculating the skew to minimize the delay when posting the messages
            const match = url.match(APICommandRegex)?.[1];
            if (match && addSkewList.includes(match) && response.headers) {
                const dateHeaderValue = response.headers.get('Date');
                const serverTime = dateHeaderValue ? new Date(dateHeaderValue).valueOf() : new Date().valueOf();
                const endTime = new Date().valueOf();
                const latency = (endTime - startTime) / 2;
                const skew = serverTime - startTime + latency;
                NetworkActions.setTimeSkew(dateHeaderValue ? skew : 0);
            }
            return response;
        })
        .then((response) => {
            // Test mode where all requests will succeed in the server, but fail to return a response
            if (shouldFailAllRequests || shouldForceOffline) {
                throw new HttpsError({
                    message: CONST.ERROR.FAILED_TO_FETCH,
                });
            }

            if (!response.ok) {
                // Expensify site is down or there was an internal server error, or something temporary like a Bad Gateway, or unknown error occurred
                const serviceInterruptedStatuses: Array<ValueOf<typeof CONST.HTTP_STATUS>> = [
                    CONST.HTTP_STATUS.INTERNAL_SERVER_ERROR,
                    CONST.HTTP_STATUS.BAD_GATEWAY,
                    CONST.HTTP_STATUS.GATEWAY_TIMEOUT,
                    CONST.HTTP_STATUS.UNKNOWN_ERROR,
                ];
                if (serviceInterruptedStatuses.indexOf(response.status as ValueOf<typeof CONST.HTTP_STATUS>) > -1) {
                    throw new HttpsError({
                        message: CONST.ERROR.EXPENSIFY_SERVICE_INTERRUPTED,
                        status: response.status.toString(),
                        title: 'Issue connecting to Expensify site',
                    });
                }
                if (response.status === CONST.HTTP_STATUS.TOO_MANY_REQUESTS) {
                    throw new HttpsError({
                        message: CONST.ERROR.THROTTLED,
                        status: response.status.toString(),
                        title: 'API request throttled',
                    });
                }

                throw new HttpsError({
                    message: response.statusText,
                    status: response.status.toString(),
                });
            }

            return response.json() as Promise<Response>;
        })
        .then((response) => {
            // Some retried requests will result in a "Unique Constraints Violation" error from the server, which just means the record already exists
            if (response.jsonCode === CONST.JSON_CODE.BAD_REQUEST && response.message === CONST.ERROR_TITLE.DUPLICATE_RECORD) {
                throw new HttpsError({
                    message: CONST.ERROR.DUPLICATE_RECORD,
                    status: CONST.JSON_CODE.BAD_REQUEST.toString(),
                    title: CONST.ERROR_TITLE.DUPLICATE_RECORD,
                });
            }

            // Auth is down or timed out while making a request
            if (response.jsonCode === CONST.JSON_CODE.EXP_ERROR && response.title === CONST.ERROR_TITLE.SOCKET && response.type === CONST.ERROR_TYPE.SOCKET) {
                throw new HttpsError({
                    message: CONST.ERROR.EXPENSIFY_SERVICE_INTERRUPTED,
                    status: CONST.JSON_CODE.EXP_ERROR.toString(),
                    title: CONST.ERROR_TITLE.SOCKET,
                });
            }

            if (response.data && (response.data?.authWriteCommands?.length ?? 0)) {
                const {phpCommandName, authWriteCommands} = response.data;
                const message = `The API command ${phpCommandName} is doing too many Auth writes. Count ${authWriteCommands.length}, commands: ${authWriteCommands.join(
                    ', ',
                )}. If you modified this command, you MUST refactor it to remove the extra Auth writes. Otherwise, update the allowed write count in Web-Expensify APIWriteCommands.`;
                alert('Too many auth writes', message);
            }
            if (response.jsonCode === CONST.JSON_CODE.UPDATE_REQUIRED) {
                // Trigger a modal and disable the app as the user needs to upgrade to the latest minimum version to continue
                UpdateRequired.alertUser();
            }
            return response as Promise<Response>;
        });
}

/**
 * Returns the filename replacing special characters with underscore
 */
function cleanFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9\-._]/g, '_');
}

type ReadFileAsync = (path: string, fileName: string, fileType?: string) => Promise<File | void>;

/**
 * Reads a locally uploaded file
 * @param path - the blob url of the locally uploaded file
 * @param fileName - name of the file to read
 */
const readFileAsync: ReadFileAsync = (path, fileName, fileType = '') =>
    new Promise((resolve) => {
        if (!path) {
            resolve();
            return;
        }
        fetch(path)
            .then((res) => {
                // For some reason, fetch is "Unable to read uploaded file"
                // on Android even though the blob is returned, so we'll ignore
                // in that case
                if (!res.ok && Platform.OS !== 'android') {
                    throw Error(res.statusText);
                }
                res.blob()
                    .then((blob) => {
                        // On Android devices, fetching blob for a file with name containing spaces fails to retrieve the type of file.
                        // In this case, let us fallback on fileType provided by the caller of this function.
                        const file = new File([blob], cleanFileName(fileName), {type: blob.type || fileType});
                        file.source = path;
                        // For some reason, the File object on iOS does not have a uri property
                        // so images aren't uploaded correctly to the backend
                        file.uri = path;
                        resolve(file);
                    })
                    .catch((e) => {
                        console.debug('[FileUtils] Could not read uploaded file', e);
                        resolve();
                    });
            })
            .catch((e) => {
                console.debug('[FileUtils] Could not read uploaded file', e);
                resolve();
            });
    });

function processFormData(data: Record<string, unknown>, shouldRecreateReceipt = false): Promise<FormData> {
    const formData = new FormData();
    let promiseChain = Promise.resolve();

    Object.keys(data).forEach((key) => {
        promiseChain = promiseChain.then(() => {
            if (typeof data[key] === 'undefined') {
                return Promise.resolve();
            }

            if (key === CONST.SEARCH.TABLE_COLUMNS.RECEIPT && shouldRecreateReceipt) {
                const {uri: path = '', source} = data[key] as File;

                console.debug('[dev] data[key]:', data[key]);
                console.debug('[dev] path', path);
                console.debug('[dev] source', source);

                return readFileAsync(source, path)
                    .then((file) => {
                        console.debug('[dev] file', file);
                        if (file) {
                            formData.append(key, file);
                        }
                    })
                    .catch(() => {
                        console.debug('[dev] Error reading photo');
                    });
            }

            formData.append(key, data[key] as string | Blob);

            return Promise.resolve();
        });
    });

    return promiseChain.then(() => formData);
}

/**
 * Makes XHR request
 * @param command the name of the API command
 * @param data parameters for the API command
 * @param type HTTP request type (get/post)
 * @param shouldUseSecure should we use the secure server
 */
function xhr(command: string, data: Record<string, unknown>, type: RequestType = CONST.NETWORK.METHOD.POST, shouldUseSecure = false): Promise<Response> {
    if (command === 'RequestMoney') {
        console.debug('[dev] data:', data);
    }

    return processFormData(data).then((formData) => {
        if (command === 'RequestMoney') {
            console.debug('[dev] formData:', formData);
            console.debug("[dev] formData.getAll('receipt'):", formData.getAll('receipt'));
        }

        const url = ApiUtils.getCommandURL({shouldUseSecure, command});

        const abortSignalController = data.canCancel ? abortControllerMap.get(command as AbortCommand) ?? abortControllerMap.get(ABORT_COMMANDS.All) : undefined;
        return processHTTPRequest(url, type, formData, abortSignalController?.signal);
    });
}

function cancelPendingRequests(command: AbortCommand = ABORT_COMMANDS.All) {
    const controller = abortControllerMap.get(command);

    controller?.abort();

    // We create a new instance because once `abort()` is called any future requests using the same controller would
    // automatically get rejected: https://dom.spec.whatwg.org/#abortcontroller-api-integration
    abortControllerMap.set(command, new AbortController());
}

export default {
    xhr,
    cancelPendingRequests,
};
