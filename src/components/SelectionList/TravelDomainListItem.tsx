import {Str} from 'expensify-common';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import SelectCircle from '@components/SelectCircle';
import TextWithTooltip from '@components/TextWithTooltip';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import BaseListItem from './BaseListItem';
import type {ListItem, ListItemProps} from './types';
import Badge from '@components/Badge';

function TravelDomainListItem<TItem extends ListItem>({
    item,
    isFocused,
    showTooltip,
    isDisabled,
    onSelectRow,
    onCheckboxPress,
    onFocus,
    shouldSyncFocus,
    shouldHighlightSelectedItem,
}: ListItemProps<TItem>) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const handleCheckboxPress = useCallback(() => {
        if (onCheckboxPress) {
            onCheckboxPress(item);
        } else {
            onSelectRow(item);
        }
    }, [item, onCheckboxPress, onSelectRow]);

    return (
        <BaseListItem
            pressableStyle={[[shouldHighlightSelectedItem && item.isSelected && styles.activeComponentBG]]}
            item={item}
            wrapperStyle={[styles.flex1, styles.sidebarLinkInner, styles.userSelectNone, styles.optionRow, styles.justifyContentBetween]}
            isFocused={isFocused}
            isDisabled={isDisabled}
            showTooltip={showTooltip}
            canSelectMultiple
            onSelectRow={onSelectRow}
            keyForList={item.keyForList}
            onFocus={onFocus}
            shouldSyncFocus={shouldSyncFocus}
        >
            {(hovered?: boolean) => (
                <>
                    <View style={[styles.flexRow, styles.alignItemsCenter]}>
                        <PressableWithFeedback
                            onPress={handleCheckboxPress}
                            disabled={isDisabled}
                            role={CONST.ROLE.BUTTON}
                            accessibilityLabel={item.text ?? ''}
                            style={[styles.mr2, styles.optionSelectCircle]}
                        >
                            <SelectCircle
                                isChecked={item.isSelected ?? false}
                                selectCircleStyles={styles.ml0}
                            />
                        </PressableWithFeedback>
                        <View style={[styles.flexRow, styles.alignItemsCenter]}>
                            <TextWithTooltip
                                shouldShowTooltip={showTooltip}
                                text={Str.removeSMSDomain(item.text ?? '')}
                                style={[
                                    styles.optionDisplayName,
                                    isFocused ? styles.sidebarLinkActiveText : styles.sidebarLinkText,
                                    item.isBold !== false && styles.sidebarLinkTextBold,
                                    styles.pre,
                                ]}
                            />
                        </View>
                    </View>
                    {item.isRecommended && <Badge text={translate('travel.domainSelector.recommended')} />}
                </>
            )}
        </BaseListItem>
    );
}

TravelDomainListItem.displayName = 'TravelDomainListItem';

export default TravelDomainListItem;
