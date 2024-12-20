import type {ReactNode} from 'react';
import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming} from 'react-native-reanimated';
import useThemeStyles from '@hooks/useThemeStyles';

type AccordionProps = {
    /** Giving information whether the component is open */
    isExpanded: SharedValue<boolean>;

    /** Element that is inside Accordion */
    children: ReactNode;

    /** Duration of expansion animation  */
    duration?: number;

    /** Additional external style */
    style?: StyleProp<ViewStyle>;
};

function Accordion({isExpanded, children, duration = 300, style}: AccordionProps) {
    const height = useSharedValue(0);
    const styles = useThemeStyles();

    const derivedHeight = useDerivedValue(() =>
        withTiming(height.value * Number(isExpanded.value), {
            duration,
            easing: Easing.inOut(Easing.quad),
        }),
    );

    const derivedOpacity = useDerivedValue(() =>
        withTiming(isExpanded.value ? 1 : 0, {
            duration,
            easing: Easing.inOut(Easing.quad),
        }),
    );

    const bodyStyle = useAnimatedStyle(() => ({
        height: derivedHeight.value,
        opacity: derivedOpacity.value,
    }));

    return (
        <Animated.View style={[bodyStyle, style]}>
            <View
                onLayout={(e) => {
                    height.value = e.nativeEvent.layout.height;
                }}
                style={[styles.pAbsolute, styles.l0, styles.r0, styles.t0]}
            >
                {children}
            </View>
        </Animated.View>
    );
}

export default Accordion;
