import type {VideoReadyForDisplayEvent} from 'expo-av';
import type {ImageContentFit} from 'expo-image';
import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import type {MergeExclusive} from 'type-fest';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import variables from '@styles/variables';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import type IconAsset from '@src/types/utils/IconAsset';
import Button from './Button';
import CheckboxWithLabel from './CheckboxWithLabel';
import ImageSVG from './ImageSVG';
import Lottie from './Lottie';
import LottieAnimations from './LottieAnimations';
import type DotLottieAnimation from './LottieAnimations/types';
import Modal from './Modal';
import SafeAreaConsumer from './SafeAreaConsumer';
import Text from './Text';
import VideoPlayer from './VideoPlayer';

// Aspect ratio and height of the video.
// Useful before video loads to reserve space.
const VIDEO_ASPECT_RATIO = 1280 / 960;

const MODAL_PADDING = variables.spacing2;

type VideoLoadedEventType = {
    srcElement: {
        videoWidth: number;
        videoHeight: number;
    };
};

type VideoStatus = 'video' | 'animation';

type BaseFeatureTrainingModalProps = {
    /** The aspect ratio to preserve for the icon, video or animation */
    illustrationAspectRatio?: number;

    /** Title for the modal */
    title?: string | React.ReactNode;

    /** Describe what is showing */
    description?: string;

    /** Secondary description rendered with additional space */
    secondaryDescription?: string;

    /** Whether to show `Don't show me this again` option */
    shouldShowDismissModalOption?: boolean;

    /** Text to show on primary button */
    confirmText: string;

    /** A callback to call when user confirms the tutorial */
    onConfirm?: () => void;

    /** A callback to call when modal closes */
    onClose?: () => void;

    /** Text to show on secondary button */
    helpText?: string;

    /** Link to navigate to when user wants to learn more */
    onHelp?: () => void;

    /** Children to show below title and description and above buttons */
    children?: React.ReactNode;

    /** Modal width */
    width?: number;
};

type FeatureTrainingModalVideoProps = {
    /** URL for the video */
    videoURL: string;

    /** Animation to show when video is unavailable. Useful when app is offline */
    animation?: DotLottieAnimation;
};

type FeatureTrainingModalSVGProps = {
    /** Expensicon for the page */
    image: IconAsset;

    /** Determines how the image should be resized to fit its container */
    contentFitImage?: ImageContentFit;
};

// This page requires either an icon or a video/animation, but not both
type FeatureTrainingModalProps = BaseFeatureTrainingModalProps & MergeExclusive<FeatureTrainingModalVideoProps, FeatureTrainingModalSVGProps>;

function FeatureTrainingModal({
    animation,
    videoURL,
    illustrationAspectRatio: illustrationAspectRatioProp,
    image,
    contentFitImage,
    width = variables.onboardingModalWidth,
    title = '',
    description = '',
    secondaryDescription = '',
    shouldShowDismissModalOption = false,
    confirmText = '',
    onConfirm = () => {},
    onClose = () => {},
    helpText = '',
    onHelp = () => {},
    children,
}: FeatureTrainingModalProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const {onboardingIsMediumOrLargerScreenWidth} = useResponsiveLayout();
    const [isModalVisible, setIsModalVisible] = useState(true);
    const [willShowAgain, setWillShowAgain] = useState(true);
    const [videoStatus, setVideoStatus] = useState<VideoStatus>('video');
    const [isVideoStatusLocked, setIsVideoStatusLocked] = useState(false);
    const [illustrationAspectRatio, setIllustrationAspectRatio] = useState(illustrationAspectRatioProp ?? VIDEO_ASPECT_RATIO);
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {isOffline} = useNetwork();

    useEffect(() => {
        if (isVideoStatusLocked) {
            return;
        }

        if (isOffline) {
            setVideoStatus('animation');
        } else if (!isOffline) {
            setVideoStatus('video');
            setIsVideoStatusLocked(true);
        }
    }, [isOffline, isVideoStatusLocked]);

    const setAspectRatio = (event: VideoReadyForDisplayEvent | VideoLoadedEventType | undefined) => {
        if (!event) {
            return;
        }

        if ('naturalSize' in event) {
            setIllustrationAspectRatio(event.naturalSize.width / event.naturalSize.height);
        } else {
            setIllustrationAspectRatio(event.srcElement.videoWidth / event.srcElement.videoHeight);
        }
    };

    const renderIllustration = useCallback(() => {
        const aspectRatio = illustrationAspectRatio || VIDEO_ASPECT_RATIO;

        return (
            <View
                style={[
                    styles.w100,
                    // Prevent layout jumps by reserving height
                    // for the video until it loads. Also, when
                    // videoStatus === 'animation' it will
                    // set the same aspect ratio as the video would.
                    {aspectRatio},
                ]}
            >
                {!!image && (
                    <ImageSVG
                        src={image}
                        contentFit={contentFitImage}
                    />
                )}
                {!!videoURL && videoStatus === 'video' && (
                    <GestureHandlerRootView>
                        <VideoPlayer
                            url={videoURL}
                            videoPlayerStyle={[styles.onboardingVideoPlayer, {aspectRatio}]}
                            onVideoLoaded={setAspectRatio}
                            controlsStatus={CONST.VIDEO_PLAYER.CONTROLS_STATUS.HIDE}
                            shouldUseControlsBottomMargin={false}
                            shouldPlay
                            isLooping
                        />
                    </GestureHandlerRootView>
                )}
                {!!videoURL && videoStatus === 'animation' && (
                    <View style={[styles.flex1, styles.alignItemsCenter, {aspectRatio}]}>
                        <Lottie
                            source={animation ?? LottieAnimations.Hands}
                            style={styles.h100}
                            webStyle={shouldUseNarrowLayout ? styles.h100 : undefined}
                            autoPlay
                            loop
                        />
                    </View>
                )}
            </View>
        );
    }, [animation, videoURL, image, contentFitImage, illustrationAspectRatio, videoStatus, shouldUseNarrowLayout, styles]);

    const toggleWillShowAgain = useCallback(() => setWillShowAgain((prevWillShowAgain) => !prevWillShowAgain), []);

    const closeModal = useCallback(() => {
        if (!willShowAgain) {
            User.dismissTrackTrainingModal();
        }
        setIsModalVisible(false);
        if (onboardingIsMediumOrLargerScreenWidth) {
            Navigation.goBack();
        }
        onClose?.();
    }, [onClose, willShowAgain, onboardingIsMediumOrLargerScreenWidth]);

    const closeAndConfirmModal = useCallback(() => {
        closeModal();
        onConfirm?.();
    }, [onConfirm, closeModal]);

    return (
        <SafeAreaConsumer>
            {({safeAreaPaddingBottomStyle}) => (
                <Modal
                    isVisible={isModalVisible}
                    type={onboardingIsMediumOrLargerScreenWidth ? CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE : CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
                    onClose={closeModal}
                    innerContainerStyle={{
                        boxShadow: 'none',
                        paddingBottom: 20,
                        paddingTop: !!image || onboardingIsMediumOrLargerScreenWidth ? undefined : MODAL_PADDING,
                        ...(onboardingIsMediumOrLargerScreenWidth
                            ? // Override styles defined by MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE
                              // To make it take as little space as possible.
                              {
                                  flex: undefined,
                                  width: 'auto',
                              }
                            : {}),
                    }}
                >
                    <View style={[styles.mh100, onboardingIsMediumOrLargerScreenWidth && StyleUtils.getWidthStyle(width), safeAreaPaddingBottomStyle]}>
                        <View style={[onboardingIsMediumOrLargerScreenWidth ? {padding: MODAL_PADDING} : {paddingHorizontal: MODAL_PADDING}, !!image && styles.p0]}>
                            {renderIllustration()}
                        </View>
                        <View style={[styles.mt5, styles.mh5]}>
                            {!!title && !!description && (
                                <View style={[onboardingIsMediumOrLargerScreenWidth ? [styles.gap1, styles.mb8] : [styles.mb10], !!image && styles.mb5]}>
                                    {typeof title === 'string' ? <Text style={[styles.textHeadlineH1]}>{title}</Text> : title}
                                    <Text style={styles.textSupporting}>{description}</Text>
                                    {secondaryDescription.length > 0 && <Text style={[styles.textSupporting, styles.mt4]}>{secondaryDescription}</Text>}
                                </View>
                            )}
                            {children}
                            {shouldShowDismissModalOption && (
                                <CheckboxWithLabel
                                    label={translate('featureTraining.doNotShowAgain')}
                                    accessibilityLabel={translate('featureTraining.doNotShowAgain')}
                                    style={[styles.mb5]}
                                    isChecked={!willShowAgain}
                                    onInputChange={toggleWillShowAgain}
                                />
                            )}
                            {!!helpText && (
                                <Button
                                    large
                                    style={[styles.mb3]}
                                    onPress={onHelp}
                                    text={helpText}
                                />
                            )}
                            <Button
                                large
                                success
                                pressOnEnter
                                onPress={closeAndConfirmModal}
                                text={confirmText}
                            />
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaConsumer>
    );
}

export default FeatureTrainingModal;
