import React from 'react';
import type {FC} from 'react';
import {Platform, View} from 'react-native';
import type {CustomRendererProps, TPhrasing, TText} from 'react-native-render-html';
import type {SvgProps} from 'react-native-svg';
import GlobalCreateIcon from '@assets/images/customEmoji/global-create.svg';
import CustomEmojiWithDefaultPressableAction from '@components/HTMLEngineProvider/CustomEmojiWithDefaultPressableAction';
import ImageSVG from '@components/ImageSVG';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

// eslint-disable-next-line rulesdir/no-inline-named-export
export const emojiMap: Record<string, FC<SvgProps>> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'action-menu-icon': GlobalCreateIcon,
};

function CustomEmojiRenderer({tnode}: CustomRendererProps<TText | TPhrasing>) {
    const styles = useThemeStyles();
    const emojiKey = tnode.attributes.emoji;
    const positionFix = Platform.OS !== 'web' && {height: '5%'};

    if (emojiMap[emojiKey]) {
        const image = (
            <View style={[styles.customEmoji, positionFix]}>
                <ImageSVG
                    src={emojiMap[emojiKey]}
                    width={variables.iconSizeNormal}
                    height={variables.iconSizeNormal}
                />
            </View>
        );

        if ('pressablewithdefaultaction' in tnode.attributes) {
            return <CustomEmojiWithDefaultPressableAction emojiKey={emojiKey}>{image}</CustomEmojiWithDefaultPressableAction>;
        }

        return image;
    }

    return null;
}

export default CustomEmojiRenderer;
