import type {AnimationObject, LottieViewProps} from 'lottie-react-native';
import LottieView from 'lottie-react-native';
import type {ForwardedRef} from 'react';
import React, {forwardRef, useEffect, useState} from 'react';
import {InteractionManager, View} from 'react-native';
import type DotLottieAnimation from '@components/LottieAnimations/types';
import useAppState from '@hooks/useAppState';
import useNetwork from '@hooks/useNetwork';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import isLastRouteRHP from '@libs/Navigation/isLastRouteRHP';
import CONST from '@src/CONST';
import {useSplashScreenStateContext} from '@src/SplashScreenStateContext';

type Props = {
    source: DotLottieAnimation;
} & Omit<LottieViewProps, 'source'>;

function Lottie({source, webStyle, ...props}: Props, ref: ForwardedRef<LottieView>) {
    const appState = useAppState();
    const {splashScreenState} = useSplashScreenStateContext();
    const styles = useThemeStyles();
    const [isError, setIsError] = React.useState(false);

    useNetwork({onReconnect: () => setIsError(false)});

    const [animationFile, setAnimationFile] = useState<string | AnimationObject | {uri: string}>();
    const [isInteractionComplete, setIsInteractionComplete] = useState(false);
    const isLastRouteInRHP = isLastRouteRHP();
    const {isSmallScreenWidth} = useResponsiveLayout();

    useEffect(() => {
        setAnimationFile(source.file);
    }, [setAnimationFile, source.file]);

    useEffect(() => {
        if (!isLastRouteInRHP) {
            return;
        }

        const interactionTask = InteractionManager.runAfterInteractions(() => {
            setIsInteractionComplete(true);
        });

        return () => {
            interactionTask.cancel();
        };
    }, []);

    const aspectRatioStyle = styles.aspectRatioLottie(source);

    // If the image fails to load, app is in background state, animation file isn't ready, or the splash screen isn't hidden yet,
    // we'll just render an empty view as the fallback to prevent
    // 1. memory leak, see issue: https://github.com/Expensify/App/issues/36645
    // 2. heavy rendering, see issue: https://github.com/Expensify/App/issues/34696
    // 3. lag on react navigation transitions, see issue: https://github.com/Expensify/App/issues/44812
    if (isError || appState.isBackground || !animationFile || splashScreenState !== CONST.BOOT_SPLASH_STATE.HIDDEN || (!isInteractionComplete && isLastRouteInRHP && isSmallScreenWidth)) {
        return <View style={[aspectRatioStyle, props.style]} />;
    }

    return (
        <LottieView
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            source={animationFile}
            ref={ref}
            style={[aspectRatioStyle, props.style]}
            webStyle={{...aspectRatioStyle, ...webStyle}}
            onAnimationFailure={() => setIsError(true)}
        />
    );
}

Lottie.displayName = 'Lottie';

export default forwardRef(Lottie);
