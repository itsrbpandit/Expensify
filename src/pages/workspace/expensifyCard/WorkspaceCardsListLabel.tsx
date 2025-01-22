import {useRoute} from '@react-navigation/native';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import Popover from '@components/Popover';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import getClickedTargetLocation from '@libs/getClickedTargetLocation';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import * as PolicyUtils from '@libs/PolicyUtils';
import type {FullScreenNavigatorParamList} from '@navigation/types';
import variables from '@styles/variables';
import * as Policy from '@userActions/Policy/Policy';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';

type WorkspaceCardsListLabelProps = {
    /** Label type */
    type: ValueOf<typeof CONST.WORKSPACE_CARDS_LIST_LABEL_TYPE>;

    /** Label value */
    value: number;

    /** Additional style props */
    style?: StyleProp<ViewStyle>;
};

function WorkspaceCardsListLabel({type, value, style}: WorkspaceCardsListLabelProps) {
    const route = useRoute<PlatformStackRouteProp<FullScreenNavigatorParamList, typeof SCREENS.WORKSPACE.EXPENSIFY_CARD>>();
    const policy = usePolicy(route.params.policyID);
    const styles = useThemeStyles();
    const {windowWidth} = useWindowDimensions();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const theme = useTheme();
    const {translate} = useLocalize();
    const [bankAccountList] = useOnyx(ONYXKEYS.BANK_ACCOUNT_LIST);
    const [isVisible, setVisible] = useState(false);
    const [anchorPosition, setAnchorPosition] = useState({top: 0, left: 0});
    const anchorRef = useRef(null);

    const workspaceAccountID = PolicyUtils.getWorkspaceAccountID(route.params.policyID);

    const policyCurrency = useMemo(() => policy?.outputCurrency ?? CONST.CURRENCY.USD, [policy]);
    const [cardSettings] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${workspaceAccountID}`);
    const [cardManualBilling] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_MANUAL_BILLING}${workspaceAccountID}`);
    const paymentBankAccountID = cardSettings?.paymentBankAccountID;

    const isConnectedWithPlaid = useMemo(() => {
        const bankAccountData = bankAccountList?.[paymentBankAccountID ?? 0]?.accountData;

        // TODO: remove the extra check when plaidAccountID storing is aligned in https://github.com/Expensify/App/issues/47944
        // Right after adding a bank account plaidAccountID is stored inside the accountData and not in the additionalData
        return !!bankAccountData?.plaidAccountID || !!bankAccountData?.additionalData?.plaidAccountID;
    }, [bankAccountList, paymentBankAccountID]);

    useEffect(() => {
        if (!anchorRef.current || !isVisible) {
            return;
        }

        const position = getClickedTargetLocation(anchorRef.current);
        const BOTTOM_MARGIN_OFFSET = 3;

        setAnchorPosition({
            top: position.top + position.height + BOTTOM_MARGIN_OFFSET,
            left: position.left,
        });
    }, [isVisible, windowWidth]);

    const requestLimitIncrease = () => {
        Policy.requestExpensifyCardLimitIncrease(cardSettings?.paymentBankAccountID);
        setVisible(false);
        Report.navigateToConciergeChat();
    };

    const isCurrentBalanceType = type === CONST.WORKSPACE_CARDS_LIST_LABEL_TYPE.CURRENT_BALANCE;
    const isSettleBalanceButtonDisplayed = !!cardSettings?.isMonthlySettlementAllowed && !cardManualBilling && isCurrentBalanceType;
    const isSettleDateTextDisplayed = !!cardManualBilling && isCurrentBalanceType;

    return (
        <View style={[styles.flex1]}>
            <View style={[styles.flex1, styles.flexRow, styles.flexWrap]}>
                <View style={[styles.flexShrink0, isSettleBalanceButtonDisplayed && styles.mr2]}>
                    <View
                        ref={anchorRef}
                        style={[styles.flexRow, styles.alignItemsCenter, styles.mb1, style]}
                    >
                        <Text style={[styles.mutedNormalTextLabel, styles.mr1]}>{translate(`workspace.expensifyCard.${type}`)}</Text>
                        <PressableWithFeedback
                            accessibilityLabel={translate(`workspace.expensifyCard.${type}`)}
                            accessibilityRole={CONST.ROLE.BUTTON}
                            onPress={() => setVisible(true)}
                        >
                            <Icon
                                src={Expensicons.Info}
                                width={variables.iconSizeExtraSmall}
                                height={variables.iconSizeExtraSmall}
                                fill={theme.icon}
                            />
                        </PressableWithFeedback>
                    </View>
                    <Text style={styles.shortTermsHeadline}>{CurrencyUtils.convertToDisplayString(value, policyCurrency)}</Text>
                </View>
                {isSettleBalanceButtonDisplayed && (
                    <View style={[styles.flexBasisAuto, styles.alignItemsStart, styles.justifyContentEnd, styles.mt2, styles.mr2]}>
                        <Button
                            onPress={() => {}}
                            text={translate('workspace.expensifyCard.settleBalance')}
                            innerStyles={[styles.buttonSmall]}
                            textStyles={[styles.buttonSmallText]}
                        />
                    </View>
                )}
            </View>
            {isSettleDateTextDisplayed && (
                <Text style={[styles.mutedNormalTextLabel, styles.mt1]}>{translate('workspace.expensifyCard.balanceWillBeSettledOn', {settlementDate: 'date'})}</Text>
            )}
            <Popover
                onClose={() => setVisible(false)}
                isVisible={isVisible}
                outerStyle={!shouldUseNarrowLayout ? styles.pr5 : undefined}
                innerContainerStyle={!shouldUseNarrowLayout ? {maxWidth: variables.modalContentMaxWidth} : undefined}
                anchorRef={anchorRef}
                anchorPosition={anchorPosition}
            >
                <View style={styles.p4}>
                    <Text
                        numberOfLines={1}
                        style={[styles.optionDisplayName, styles.textStrong, styles.mb2]}
                    >
                        {translate(`workspace.expensifyCard.${type}`)}
                    </Text>
                    <Text style={[styles.textLabelSupporting, styles.lh16]}>{translate(`workspace.expensifyCard.${type}Description`)}</Text>

                    {!isConnectedWithPlaid && type === CONST.WORKSPACE_CARDS_LIST_LABEL_TYPE.REMAINING_LIMIT && (
                        <View style={[styles.flexRow, styles.mt3]}>
                            <Button
                                onPress={requestLimitIncrease}
                                text={translate('workspace.expensifyCard.requestLimitIncrease')}
                                style={shouldUseNarrowLayout && styles.flex1}
                            />
                        </View>
                    )}
                </View>
            </Popover>
        </View>
    );
}

export default WorkspaceCardsListLabel;
