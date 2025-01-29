import {useIsFocused} from '@react-navigation/native';
import {Str} from 'expensify-common';
import React, {useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {ActivityIndicator, PanResponder, PixelRatio, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type Webcam from 'react-webcam';
import Hand from '@assets/images/hand.svg';
import ReceiptUpload from '@assets/images/receipt-upload.svg';
import Shutter from '@assets/images/shutter.svg';
import type {FileObject} from '@components/AttachmentModal';
import AttachmentPicker from '@components/AttachmentPicker';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import CopyTextToClipboard from '@components/CopyTextToClipboard';
import {DragAndDropContext} from '@components/DragAndDrop/Provider';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import LocationPermissionModal from '@components/LocationPermissionModal';
import PDFThumbnail from '@components/PDFThumbnail';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {isMobile, isMobileWebKit} from '@libs/Browser';
import {base64ToFile, resizeImageIfNeeded} from '@libs/fileDownload/FileUtils';
import getCurrentPosition from '@libs/getCurrentPosition';
import {shouldStartLocationPermissionFlow} from '@libs/IOUUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantsOption, getReportOption} from '@libs/OptionsListUtils';
import {validateReceipt} from '@libs/ReceiptUtils';
import {isArchivedReport, isPolicyExpenseChat} from '@libs/ReportUtils';
import playSound, {SOUNDS} from '@libs/Sound';
import {getDefaultTaxCode} from '@libs/TransactionUtils';
import ReceiptDropUI from '@pages/iou/ReceiptDropUI';
import StepScreenDragAndDropWrapper from '@pages/iou/request/step/StepScreenDragAndDropWrapper';
import withFullTransactionOrNotFound from '@pages/iou/request/step/withFullTransactionOrNotFound';
import withWritableReportOrNotFound from '@pages/iou/request/step/withWritableReportOrNotFound';
import {
    replaceReceipt,
    requestMoney,
    setMoneyRequestParticipantsFromReport,
    setMoneyRequestReceipt,
    startSplitBill,
    trackExpense,
    updateLastLocationPermissionPrompt,
} from '@userActions/IOU';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Participant} from '@src/types/onyx/IOU';
import type {Receipt} from '@src/types/onyx/Transaction';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import NavigationAwareCamera from './NavigationAwareCamera/WebCamera';
import type IOURequestStepScanProps from './types';

function IOURequestStepScan({
    report,
    route: {
        params: {action, iouType, reportID, transactionID, backTo},
    },
    transaction,
    currentUserPersonalDetails,
}: Omit<IOURequestStepScanProps, 'user'>) {
    const theme = useTheme();
    const styles = useThemeStyles();

    // Grouping related states
    const [isAttachmentInvalid, setIsAttachmentInvalid] = useState(false);
    const [attachmentInvalidReasonTitle, setAttachmentInvalidReasonTitle] = useState<TranslationPaths>();
    const [attachmentInvalidReason, setAttachmentValidReason] = useState<TranslationPaths>();
    const [pdfFile, setPdfFile] = useState<null | FileObject>(null);
    const [startLocationPermissionFlow, setStartLocationPermissionFlow] = useState(false);
    const [fileResize, setFileResize] = useState<null | FileObject>(null);
    const [fileSource, setFileSource] = useState('');
    const [receiptImageTopPosition, setReceiptImageTopPosition] = useState(0);
    // we need to use isSmallScreenWidth instead of shouldUseNarrowLayout because drag and drop is not supported on mobile
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();
    const {translate} = useLocalize();
    const {isDraggingOver} = useContext(DragAndDropContext);
    const [cameraPermissionState, setCameraPermissionState] = useState<PermissionState | undefined>('prompt');
    const [isFlashLightOn, toggleFlashlight] = useReducer((state) => !state, false);
    const [isTorchAvailable, setIsTorchAvailable] = useState(false);
    const cameraRef = useRef<Webcam>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const [isQueriedPermissionState, setIsQueriedPermissionState] = useState(false);

    const getScreenshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID}`);
    const policy = usePolicy(report?.policyID);
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST);
    const [skipConfirmation] = useOnyx(`${ONYXKEYS.COLLECTION.SKIP_CONFIRMATION}${transactionID}`);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints>();
    const isTabActive = useIsFocused();

    const isEditing = action === CONST.IOU.ACTION.EDIT;
    const defaultTaxCode = getDefaultTaxCode(policy, transaction);
    const transactionTaxCode = (transaction?.taxCode ? transaction?.taxCode : defaultTaxCode) ?? '';
    const transactionTaxAmount = transaction?.taxAmount ?? 0;

    // For quick button actions, we'll skip the confirmation page unless the report is archived or this is a workspace
    // request and the workspace requires a category or a tag
    const shouldSkipConfirmation: boolean = useMemo(() => {
        if (!skipConfirmation || !report?.reportID) {
            return false;
        }

        return !isArchivedReport(reportNameValuePairs) && !(isPolicyExpenseChat(report) && ((policy?.requiresCategory ?? false) || (policy?.requiresTag ?? false)));
    }, [report, skipConfirmation, policy, reportNameValuePairs]);

    /**
     * On phones that have ultra-wide lens, react-webcam uses ultra-wide by default.
     * The last deviceId is of regular len camera.
     */
    const requestCameraPermission = useCallback(() => {
        if (!isMobile()) {
            return;
        }

        const defaultConstraints = {facingMode: {exact: 'environment'}};
        navigator.mediaDevices
            .getUserMedia({video: {facingMode: {exact: 'environment'}, zoom: {ideal: 1}}})
            .then((stream) => {
                setCameraPermissionState('granted');
                stream.getTracks().forEach((track) => track.stop());
                // Only Safari 17+ supports zoom constraint
                if (isMobileWebKit() && stream.getTracks().length > 0) {
                    let deviceId;
                    for (const track of stream.getTracks()) {
                        const setting = track.getSettings();
                        if (setting.zoom === 1) {
                            deviceId = setting.deviceId;
                            break;
                        }
                    }
                    if (deviceId) {
                        setVideoConstraints({deviceId});
                        return;
                    }
                }
                if (!navigator.mediaDevices.enumerateDevices) {
                    setVideoConstraints(defaultConstraints);
                    return;
                }
                navigator.mediaDevices.enumerateDevices().then((devices) => {
                    let lastBackDeviceId = '';
                    for (let i = devices.length - 1; i >= 0; i--) {
                        const device = devices.at(i);
                        if (device?.kind === 'videoinput') {
                            lastBackDeviceId = device.deviceId;
                            break;
                        }
                    }
                    if (!lastBackDeviceId) {
                        setVideoConstraints(defaultConstraints);
                        return;
                    }
                    setVideoConstraints({deviceId: lastBackDeviceId});
                });
            })
            .catch(() => {
                setVideoConstraints(defaultConstraints);
                setCameraPermissionState('denied');
            });
    }, []);

    useEffect(() => {
        if (!isMobile() || !isTabActive) {
            setVideoConstraints(undefined);
            return;
        }
        navigator.permissions
            .query({
                name: 'camera',
            })
            .then((permissionState) => {
                setCameraPermissionState(permissionState.state);
                if (permissionState.state === 'granted') {
                    requestCameraPermission();
                }
            })
            .catch(() => {
                setCameraPermissionState('denied');
            })
            .finally(() => {
                setIsQueriedPermissionState(true);
            });
        // We only want to get the camera permission status when the component is mounted
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [isTabActive]);

    const hideReceiptModal = () => {
        setIsAttachmentInvalid(false);
    };

    /**
     * Sets the upload receipt error modal content when an invalid receipt is uploaded
     */
    const setUploadReceiptError = (isInvalid: boolean, title: TranslationPaths, reason: TranslationPaths) => {
        setIsAttachmentInvalid(isInvalid);
        setAttachmentInvalidReasonTitle(title);
        setAttachmentValidReason(reason);
        setPdfFile(null);
    };

    const navigateBack = useCallback(() => {
        Navigation.goBack(backTo);
    }, [backTo]);

    const navigateToParticipantPage = useCallback(() => {
        switch (iouType) {
            case CONST.IOU.TYPE.REQUEST:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(CONST.IOU.TYPE.SUBMIT, transactionID, reportID));
                break;
            case CONST.IOU.TYPE.SEND:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(CONST.IOU.TYPE.PAY, transactionID, reportID));
                break;
            default:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(iouType, transactionID, reportID));
        }
    }, [iouType, reportID, transactionID]);

    const navigateToConfirmationPage = useCallback(() => {
        switch (iouType) {
            case CONST.IOU.TYPE.REQUEST:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.SUBMIT, transactionID, reportID));
                break;
            case CONST.IOU.TYPE.SEND:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.PAY, transactionID, reportID));
                break;
            default:
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, iouType, transactionID, reportID));
        }
    }, [iouType, reportID, transactionID]);

    const createTransaction = useCallback(
        (receipt: Receipt, participant: Participant) => {
            if (iouType === CONST.IOU.TYPE.TRACK && report) {
                trackExpense(
                    report,
                    0,
                    transaction?.currency ?? 'USD',
                    transaction?.created ?? '',
                    '',
                    currentUserPersonalDetails.login,
                    currentUserPersonalDetails.accountID,
                    participant,
                    '',
                    false,
                    receipt,
                );
            } else {
                requestMoney({
                    report,
                    participantParams: {
                        payeeEmail: currentUserPersonalDetails.login,
                        payeeAccountID: currentUserPersonalDetails.accountID,
                        participant,
                    },
                    transactionParams: {
                        amount: 0,
                        attendees: transaction?.attendees,
                        currency: transaction?.currency ?? 'USD',
                        created: transaction?.created ?? '',
                        merchant: '',
                        receipt,
                    },
                });
            }
        },
        [currentUserPersonalDetails.accountID, currentUserPersonalDetails.login, iouType, report, transaction?.attendees, transaction?.created, transaction?.currency],
    );

    const navigateToConfirmationStep = useCallback(
        (file: FileObject, source: string, locationPermissionGranted = false) => {
            if (backTo) {
                Navigation.goBack(backTo);
                return;
            }

            // If the transaction was created from the global create, the person needs to select participants, so take them there.
            // If the user started this flow using the Create expense option (combined submit/track flow), they should be redirected to the participants page.
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            if ((transaction?.isFromGlobalCreate && iouType !== CONST.IOU.TYPE.TRACK && !report?.reportID) || iouType === CONST.IOU.TYPE.CREATE) {
                navigateToParticipantPage();
                return;
            }

            // If the transaction was created from the + menu from the composer inside of a chat, the participants can automatically
            // be added to the transaction (taken from the chat report participants) and then the person is taken to the confirmation step.
            const selectedParticipants = setMoneyRequestParticipantsFromReport(transactionID, report);
            const participants = selectedParticipants.map((participant) => {
                const participantAccountID = participant?.accountID ?? CONST.DEFAULT_NUMBER_ID;
                return participantAccountID ? getParticipantsOption(participant, personalDetails) : getReportOption(participant);
            });

            if (shouldSkipConfirmation) {
                const receipt: Receipt = file;
                receipt.source = source;
                receipt.state = CONST.IOU.RECEIPT_STATE.SCANREADY;
                if (iouType === CONST.IOU.TYPE.SPLIT) {
                    playSound(SOUNDS.DONE);
                    startSplitBill({
                        participants,
                        currentUserLogin: currentUserPersonalDetails?.login ?? '',
                        currentUserAccountID: currentUserPersonalDetails.accountID,
                        comment: '',
                        receipt,
                        existingSplitChatReportID: reportID,
                        billable: false,
                        category: '',
                        tag: '',
                        currency: transaction?.currency ?? 'USD',
                        taxCode: transactionTaxCode,
                        taxAmount: transactionTaxAmount,
                    });
                    return;
                }
                const participant = participants.at(0);
                if (!participant) {
                    return;
                }
                if (locationPermissionGranted) {
                    getCurrentPosition(
                        (successData) => {
                            playSound(SOUNDS.DONE);
                            if (iouType === CONST.IOU.TYPE.TRACK && report) {
                                trackExpense(
                                    report,
                                    0,
                                    transaction?.currency ?? 'USD',
                                    transaction?.created ?? '',
                                    '',
                                    currentUserPersonalDetails.login,
                                    currentUserPersonalDetails.accountID,
                                    participant,
                                    '',
                                    false,
                                    receipt,
                                    '',
                                    '',
                                    '',
                                    0,
                                    false,
                                    policy,
                                    {},
                                    {},
                                    {
                                        lat: successData.coords.latitude,
                                        long: successData.coords.longitude,
                                    },
                                );
                            } else {
                                requestMoney({
                                    report,
                                    participantParams: {
                                        payeeEmail: currentUserPersonalDetails.login,
                                        payeeAccountID: currentUserPersonalDetails.accountID,
                                        participant,
                                    },
                                    policyParams: {
                                        policy,
                                    },
                                    gpsPoints: {
                                        lat: successData.coords.latitude,
                                        long: successData.coords.longitude,
                                    },
                                    transactionParams: {
                                        amount: 0,
                                        attendees: transaction?.attendees,
                                        currency: transaction?.currency ?? 'USD',
                                        created: transaction?.created ?? '',
                                        merchant: '',
                                        receipt,
                                        billable: false,
                                    },
                                });
                            }
                        },
                        (errorData) => {
                            Log.info('[IOURequestStepScan] getCurrentPosition failed', false, errorData);
                            // When there is an error, the money can still be requested, it just won't include the GPS coordinates
                            playSound(SOUNDS.DONE);
                            createTransaction(receipt, participant);
                        },
                        {
                            maximumAge: CONST.GPS.MAX_AGE,
                            timeout: CONST.GPS.TIMEOUT,
                        },
                    );
                    return;
                }
                playSound(SOUNDS.DONE);
                createTransaction(receipt, participant);
                return;
            }
            navigateToConfirmationPage();
        },
        [
            backTo,
            transaction?.isFromGlobalCreate,
            transaction?.attendees,
            transaction?.currency,
            transaction?.created,
            iouType,
            report,
            transactionID,
            shouldSkipConfirmation,
            navigateToConfirmationPage,
            navigateToParticipantPage,
            personalDetails,
            currentUserPersonalDetails.login,
            currentUserPersonalDetails.accountID,
            reportID,
            transactionTaxCode,
            transactionTaxAmount,
            policy,
            createTransaction,
        ],
    );

    const updateScanAndNavigate = useCallback(
        (file: FileObject, source: string) => {
            replaceReceipt(transactionID, file as File, source);
            navigateBack();
        },
        [transactionID, navigateBack],
    );

    /**
     * Sets the Receipt objects and navigates the user to the next page
     */
    const setReceiptAndNavigate = (originalFile: FileObject, isPdfValidated?: boolean) => {
        validateReceipt(originalFile).then((result) => {
            if (!result.isValid) {
                if (result.title && result.reason) {
                    setUploadReceiptError(true, result.title, result.reason);
                }
                return;
            }

            // If we have a pdf file and if it is not validated then set the pdf file for validation and return
            if (Str.isPDF(originalFile.name ?? '') && !isPdfValidated) {
                setPdfFile(originalFile);
                return;
            }

            // With the image size > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE, we use manipulateAsync to resize the image.
            // It takes a long time so we should display a loading indicator while the resize image progresses.
            if (Str.isImage(originalFile.name ?? '') && (originalFile?.size ?? 0) > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE) {
                setIsLoadingReceipt(true);
            }
            resizeImageIfNeeded(originalFile).then((file) => {
                setIsLoadingReceipt(false);
                // Store the receipt on the transaction object in Onyx
                const source = URL.createObjectURL(file as Blob);
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                setMoneyRequestReceipt(transactionID, source, file.name || '', !isEditing);

                if (isEditing) {
                    updateScanAndNavigate(file, source);
                    return;
                }
                if (shouldSkipConfirmation) {
                    setFileResize(file);
                    setFileSource(source);
                    const gpsRequired = transaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT && file;
                    if (gpsRequired) {
                        const beginLocationPermissionFlow = shouldStartLocationPermissionFlow();

                        if (beginLocationPermissionFlow) {
                            setStartLocationPermissionFlow(true);
                            return;
                        }
                    }
                }
                navigateToConfirmationStep(file, source, false);
            });
        });
    };

    const setupCameraPermissionsAndCapabilities = (stream: MediaStream) => {
        setCameraPermissionState('granted');

        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if ('torch' in capabilities && capabilities.torch) {
            trackRef.current = track;
        }
        setIsTorchAvailable('torch' in capabilities && !!capabilities.torch);
    };

    const getScreenshot = useCallback(() => {
        if (!cameraRef.current) {
            requestCameraPermission();
            return;
        }

        const imageBase64 = cameraRef.current.getScreenshot();

        if (imageBase64 === null) {
            return;
        }

        const filename = `receipt_${Date.now()}.png`;
        const file = base64ToFile(imageBase64 ?? '', filename);
        const source = URL.createObjectURL(file);
        setMoneyRequestReceipt(transactionID, source, file.name, !isEditing);

        if (isEditing) {
            updateScanAndNavigate(file, source);
            return;
        }
        if (shouldSkipConfirmation) {
            setFileResize(file);
            setFileSource(source);
            const gpsRequired = transaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT && file;
            if (gpsRequired) {
                const beginLocationPermissionFlow = shouldStartLocationPermissionFlow();
                if (beginLocationPermissionFlow) {
                    setStartLocationPermissionFlow(true);
                    return;
                }
            }
        }
        navigateToConfirmationStep(file, source, false);
    }, [transactionID, isEditing, shouldSkipConfirmation, navigateToConfirmationStep, requestCameraPermission, updateScanAndNavigate, transaction?.amount, iouType]);

    const clearTorchConstraints = useCallback(() => {
        if (!trackRef.current) {
            return;
        }
        trackRef.current.applyConstraints({
            advanced: [{torch: false}],
        });
    }, []);

    const capturePhoto = useCallback(() => {
        if (trackRef.current && isFlashLightOn) {
            trackRef.current
                .applyConstraints({
                    advanced: [{torch: true}],
                })
                .then(() => {
                    getScreenshotTimeoutRef.current = setTimeout(() => {
                        getScreenshot();
                        clearTorchConstraints();
                    }, 2000);
                });
            return;
        }

        getScreenshot();
    }, [isFlashLightOn, getScreenshot, clearTorchConstraints]);

    const panResponder = useRef(
        PanResponder.create({
            onPanResponderTerminationRequest: () => false,
        }),
    ).current;

    useEffect(
        () => () => {
            if (!getScreenshotTimeoutRef.current) {
                return;
            }
            clearTimeout(getScreenshotTimeoutRef.current);
        },
        [],
    );

    const PDFThumbnailView = pdfFile ? (
        <PDFThumbnail
            style={styles.invisiblePDF}
            previewSourceURL={pdfFile.uri ?? ''}
            onLoadSuccess={() => {
                setPdfFile(null);
                setReceiptAndNavigate(pdfFile, true);
            }}
            onPassword={() => {
                setUploadReceiptError(true, 'attachmentPicker.attachmentError', 'attachmentPicker.protectedPDFNotSupported');
            }}
            onLoadError={() => {
                setUploadReceiptError(true, 'attachmentPicker.attachmentError', 'attachmentPicker.errorWhileSelectingCorruptedAttachment');
            }}
        />
    ) : null;

    const getConfirmModalPrompt = () => {
        if (!attachmentInvalidReason) {
            return '';
        }
        if (attachmentInvalidReason === 'attachmentPicker.sizeExceededWithLimit') {
            return translate(attachmentInvalidReason, {maxUploadSizeInMB: CONST.API_ATTACHMENT_VALIDATIONS.RECEIPT_MAX_SIZE / (1024 * 1024)});
        }
        return translate(attachmentInvalidReason);
    };

    const mobileCameraView = () => (
        <>
            <View style={[styles.cameraView]}>
                {PDFThumbnailView}
                {((cameraPermissionState === 'prompt' && !isQueriedPermissionState) || (cameraPermissionState === 'granted' && isEmptyObject(videoConstraints))) && (
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={[styles.flex1]}
                        color={theme.textSupporting}
                    />
                )}
                {cameraPermissionState !== 'granted' && isQueriedPermissionState && (
                    <View style={[styles.flex1, styles.permissionView, styles.userSelectNone]}>
                        <Icon
                            src={Hand}
                            width={CONST.RECEIPT.HAND_ICON_WIDTH}
                            height={CONST.RECEIPT.HAND_ICON_HEIGHT}
                            additionalStyles={[styles.pb5]}
                        />
                        <Text style={[styles.textFileUpload]}>{translate('receipt.takePhoto')}</Text>
                        {cameraPermissionState === 'denied' ? (
                            <Text style={[styles.subTextFileUpload]}>
                                {translate('receipt.deniedCameraAccess')}
                                <TextLink href={CONST.DENIED_CAMERA_ACCESS_INSTRUCTIONS_URL}>{translate('receipt.deniedCameraAccessInstructions')}</TextLink>.
                            </Text>
                        ) : (
                            <Text style={[styles.subTextFileUpload]}>{translate('receipt.cameraAccess')}</Text>
                        )}
                        <Button
                            success
                            text={translate('common.continue')}
                            accessibilityLabel={translate('common.continue')}
                            style={[styles.p9, styles.pt5]}
                            onPress={capturePhoto}
                        />
                    </View>
                )}
                {cameraPermissionState === 'granted' && !isEmptyObject(videoConstraints) && (
                    <NavigationAwareCamera
                        onUserMedia={setupCameraPermissionsAndCapabilities}
                        onUserMediaError={() => setCameraPermissionState('denied')}
                        style={{...styles.videoContainer, display: cameraPermissionState !== 'granted' ? 'none' : 'block'}}
                        ref={cameraRef}
                        screenshotFormat="image/png"
                        videoConstraints={videoConstraints}
                        forceScreenshotSourceSize
                        audio={false}
                        disablePictureInPicture={false}
                        imageSmoothing={false}
                        mirrored={false}
                        screenshotQuality={0}
                    />
                )}
            </View>

            <View style={[styles.flexRow, styles.justifyContentAround, styles.alignItemsCenter, styles.pv3]}>
                <AttachmentPicker acceptedFileTypes={[...CONST.API_ATTACHMENT_VALIDATIONS.ALLOWED_RECEIPT_EXTENSIONS]}>
                    {({openPicker}) => (
                        <PressableWithFeedback
                            accessibilityLabel={translate('common.chooseFile')}
                            role={CONST.ROLE.BUTTON}
                            onPress={() => {
                                openPicker({
                                    onPicked: (data) => setReceiptAndNavigate(data.at(0) ?? {}),
                                });
                            }}
                        >
                            <Icon
                                height={32}
                                width={32}
                                src={Expensicons.Gallery}
                                fill={theme.textSupporting}
                            />
                        </PressableWithFeedback>
                    )}
                </AttachmentPicker>
                <PressableWithFeedback
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={translate('receipt.shutter')}
                    style={[styles.alignItemsCenter]}
                    onPress={capturePhoto}
                >
                    <Shutter
                        width={CONST.RECEIPT.SHUTTER_SIZE}
                        height={CONST.RECEIPT.SHUTTER_SIZE}
                    />
                </PressableWithFeedback>
                <PressableWithFeedback
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={translate('receipt.flash')}
                    style={[styles.alignItemsEnd, !isTorchAvailable && styles.opacity0]}
                    onPress={toggleFlashlight}
                    disabled={!isTorchAvailable}
                >
                    <Icon
                        height={32}
                        width={32}
                        src={isFlashLightOn ? Expensicons.Bolt : Expensicons.boltSlash}
                        fill={theme.textSupporting}
                    />
                </PressableWithFeedback>
            </View>
        </>
    );

    const desktopUploadView = () => (
        <>
            {PDFThumbnailView}
            <View onLayout={({nativeEvent}) => setReceiptImageTopPosition(PixelRatio.roundToNearestPixel((nativeEvent.layout as DOMRect).top))}>
                <ReceiptUpload
                    width={CONST.RECEIPT.ICON_SIZE}
                    height={CONST.RECEIPT.ICON_SIZE}
                />
            </View>

            <View
                style={[styles.uploadFileViewTextContainer, styles.userSelectNone]}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...panResponder.panHandlers}
            >
                <Text style={[styles.textFileUpload]}>{translate('receipt.upload')}</Text>
                <Text style={[styles.subTextFileUpload]}>
                    {isSmallScreenWidth ? translate('receipt.chooseReceipt') : translate('receipt.dragReceiptBeforeEmail')}
                    <CopyTextToClipboard
                        text={CONST.EMAIL.RECEIPTS}
                        textStyles={[styles.textBlue]}
                    />
                    {isSmallScreenWidth ? null : translate('receipt.dragReceiptAfterEmail')}
                </Text>
            </View>

            <AttachmentPicker>
                {({openPicker}) => (
                    <Button
                        success
                        text={translate('common.chooseFile')}
                        accessibilityLabel={translate('common.chooseFile')}
                        style={[styles.p9]}
                        onPress={() => {
                            openPicker({
                                onPicked: (data) => setReceiptAndNavigate(data.at(0) ?? {}),
                            });
                        }}
                    />
                )}
            </AttachmentPicker>
        </>
    );

    return (
        <StepScreenDragAndDropWrapper
            headerTitle={translate('common.receipt')}
            onBackButtonPress={navigateBack}
            shouldShowWrapper={!!backTo || isEditing}
            testID={IOURequestStepScan.displayName}
        >
            {(isDraggingOverWrapper) => (
                <>
                    {isLoadingReceipt && <FullScreenLoadingIndicator />}
                    <View style={[styles.flex1, !isMobile() && styles.uploadFileView(isSmallScreenWidth)]}>
                        {!(isDraggingOver ?? isDraggingOverWrapper) && (isMobile() ? mobileCameraView() : desktopUploadView())}
                        <ReceiptDropUI
                            onDrop={(e) => {
                                const file = e?.dataTransfer?.files[0];
                                if (file) {
                                    file.uri = URL.createObjectURL(file);
                                    setReceiptAndNavigate(file);
                                }
                            }}
                            receiptImageTopPosition={receiptImageTopPosition}
                        />
                        <ConfirmModal
                            title={attachmentInvalidReasonTitle ? translate(attachmentInvalidReasonTitle) : ''}
                            onConfirm={hideReceiptModal}
                            onCancel={hideReceiptModal}
                            isVisible={isAttachmentInvalid}
                            prompt={getConfirmModalPrompt()}
                            confirmText={translate('common.close')}
                            shouldShowCancelButton={false}
                        />
                        {startLocationPermissionFlow && !!fileResize && (
                            <LocationPermissionModal
                                startPermissionFlow={startLocationPermissionFlow}
                                resetPermissionFlow={() => setStartLocationPermissionFlow(false)}
                                onGrant={() => navigateToConfirmationStep(fileResize, fileSource, true)}
                                onDeny={() => {
                                    updateLastLocationPermissionPrompt();
                                    navigateToConfirmationStep(fileResize, fileSource, false);
                                }}
                            />
                        )}
                    </View>
                </>
            )}
        </StepScreenDragAndDropWrapper>
    );
}

IOURequestStepScan.displayName = 'IOURequestStepScan';

const IOURequestStepScanWithOnyx = IOURequestStepScan;

const IOURequestStepScanWithCurrentUserPersonalDetails = withCurrentUserPersonalDetails(IOURequestStepScanWithOnyx);
// eslint-disable-next-line rulesdir/no-negated-variables
const IOURequestStepScanWithWritableReportOrNotFound = withWritableReportOrNotFound(IOURequestStepScanWithCurrentUserPersonalDetails, true);
// eslint-disable-next-line rulesdir/no-negated-variables
const IOURequestStepScanWithFullTransactionOrNotFound = withFullTransactionOrNotFound(IOURequestStepScanWithWritableReportOrNotFound);

export default IOURequestStepScanWithFullTransactionOrNotFound;
