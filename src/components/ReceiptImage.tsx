import React from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type IconAsset from '@src/types/utils/IconAsset';
import EReceiptThumbnail from './EReceiptThumbnail';
import type {IconSize} from './EReceiptThumbnail';
import Image from './Image';
import PDFThumbnail from './PDFThumbnail';
import ReceiptEmptyState from './ReceiptEmptyState';
import ThumbnailImage from './ThumbnailImage';

type Style = {height: number; borderRadius: number; margin: number};

type ReceiptImageProps = (
    | {
          /** Transaction ID of the transaction the receipt belongs to */
          transactionID: string;

          /** Whether it is EReceipt */
          isEReceipt: boolean;

          /** Whether it is receipt preview thumbnail we are displaying */
          isThumbnail?: boolean;

          /** Url of the receipt image */
          source?: string;

          /** Whether it is a pdf thumbnail we are displaying */
          isPDFThumbnail?: boolean;
      }
    | {
          transactionID?: string;
          isEReceipt?: boolean;
          isThumbnail: boolean;
          source?: string;
          isPDFThumbnail?: boolean;
      }
    | {
          transactionID?: string;
          isEReceipt?: boolean;
          isThumbnail?: boolean;
          source: string;
          isPDFThumbnail?: boolean;
      }
    | {
          transactionID?: string;
          isEReceipt?: boolean;
          isThumbnail?: boolean;
          source: string;
          isPDFThumbnail?: string;
      }
) & {
    /** Whether we should display the receipt with ThumbnailImage component */
    shouldUseThumbnailImage?: boolean;

    /** Whether we should display the receipt with initial object position */
    shouldUseInitialObjectPosition?: boolean;

    /** Whether the receipt image requires an authToken */
    isAuthTokenRequired?: boolean;

    /** Any additional styles to apply */
    style?: Style;

    /** The file extension of the receipt file */
    fileExtension?: string;

    /** number of images displayed in the same parent container */
    iconSize?: IconSize;

    /** If the image fails to load – show the provided fallback icon */
    fallbackIcon?: IconAsset;

    /** The size of the fallback icon */
    fallbackIconSize?: number;

    /** The color of the fallback icon */
    fallbackIconColor?: string;

    /** The background color of fallback icon */
    fallbackIconBackground?: string;

    isEmptyReceipt?: boolean;

    /** Callback to be called on pressing the image */
    onPress?: () => void;
};

function ReceiptImage({
    transactionID,
    isPDFThumbnail = false,
    isThumbnail = false,
    shouldUseThumbnailImage = false,
    isEReceipt = false,
    source,
    isAuthTokenRequired,
    style,
    fileExtension,
    iconSize,
    fallbackIcon,
    fallbackIconSize,
    shouldUseInitialObjectPosition = false,
    fallbackIconColor,
    fallbackIconBackground,
    isEmptyReceipt = false,
    onPress,
}: ReceiptImageProps) {
    const styles = useThemeStyles();

    if (isEmptyReceipt) {
        return (
            <ReceiptEmptyState
                isThumbnail
                onPress={onPress}
                disabled={!onPress}
                transactionID={transactionID ?? '-1'}
            />
        );
    }

    if (isPDFThumbnail) {
        return (
            <PDFThumbnail
                previewSourceURL={source ?? ''}
                style={[styles.w100, styles.h100]}
            />
        );
    }

    if (isEReceipt || isThumbnail) {
        const props = isThumbnail && {borderRadius: style?.borderRadius, fileExtension, isReceiptThumbnail: true};
        return (
            <View style={style ?? [styles.w100, styles.h100]}>
                <EReceiptThumbnail
                    transactionID={transactionID ?? '-1'}
                    iconSize={iconSize}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...props}
                />
            </View>
        );
    }

    if (shouldUseThumbnailImage) {
        return (
            <ThumbnailImage
                previewSourceURL={source ?? ''}
                style={[styles.w100, styles.h100]}
                isAuthTokenRequired={isAuthTokenRequired ?? false}
                shouldDynamicallyResize={false}
                fallbackIcon={fallbackIcon}
                fallbackIconSize={fallbackIconSize}
                fallbackIconColor={fallbackIconColor}
                fallbackIconBackground={fallbackIconBackground}
                objectPosition={shouldUseInitialObjectPosition ? CONST.IMAGE_OBJECT_POSITION.INITIAL : CONST.IMAGE_OBJECT_POSITION.TOP}
            />
        );
    }

    return (
        <Image
            source={{uri: source}}
            style={[style ?? [styles.w100, styles.h100], styles.overflowHidden]}
            isAuthTokenRequired={isAuthTokenRequired}
        />
    );
}

export type {ReceiptImageProps};
export default ReceiptImage;
