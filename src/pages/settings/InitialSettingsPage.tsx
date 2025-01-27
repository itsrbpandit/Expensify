import {useRoute} from '@react-navigation/native';
import React, {useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {GestureResponderEvent, ScrollView as RNScrollView, ScrollViewProps, StyleProp, ViewStyle} from 'react-native';
import {NativeModules, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import AccountSwitcher from '@components/AccountSwitcher';
import AccountSwitcherSkeletonView from '@components/AccountSwitcherSkeletonView';
import ConfirmModal from '@components/ConfirmModal';
import DelegateNoAccessModal from '@components/DelegateNoAccessModal';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import {InitialURLContext} from '@components/InitialURLContextProvider';
import MenuItem from '@components/MenuItem';
import {PressableWithFeedback} from '@components/Pressable';
import ScreenWrapper from '@components/ScreenWrapper';
import {ScrollOffsetContext} from '@components/ScrollOffsetContextProvider';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import type {WithCurrentUserPersonalDetailsProps} from '@components/withCurrentUserPersonalDetails';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import useActiveCentralPaneRoute from '@hooks/useActiveCentralPaneRoute';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useSingleExecution from '@hooks/useSingleExecution';
import useSubscriptionPlan from '@hooks/useSubscriptionPlan';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import {resetExitSurveyForm} from '@libs/actions/ExitSurvey';
import {convertToDisplayString} from '@libs/CurrencyUtils';
import Navigation from '@libs/Navigation/Navigation';
import {getFreeTrialText, hasSubscriptionRedDotError} from '@libs/SubscriptionUtils';
import {getProfilePageBrickRoadIndicator} from '@libs/UserUtils';
import {hasGlobalWorkspaceSettingsRBR} from '@libs/WorkspacesSettingsUtils';
import * as ReportActionContextMenu from '@pages/home/report/ContextMenu/ReportActionContextMenu';
import variables from '@styles/variables';
import {confirmReadyToOpenApp} from '@userActions/App';
import {buildOldDotURL, openExternalLink, openOldDotLink} from '@userActions/Link';
import {hasPaymentMethodError} from '@userActions/PaymentMethods';
import {isSupportAuthToken, signOutAndRedirectToSignIn} from '@userActions/Session';
import {openInitialSettingsPage} from '@userActions/Wallet';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type {Icon as TIcon} from '@src/types/onyx/OnyxCommon';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';

type InitialSettingsPageProps = WithCurrentUserPersonalDetailsProps;

type MenuData = {
    translationKey: TranslationPaths;
    icon: IconAsset;
    routeName?: Route;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>;
    action?: () => void;
    link?: string | (() => Promise<string>);
    iconType?: typeof CONST.ICON_TYPE_ICON | typeof CONST.ICON_TYPE_AVATAR | typeof CONST.ICON_TYPE_WORKSPACE;
    iconStyles?: StyleProp<ViewStyle>;
    fallbackIcon?: IconAsset;
    shouldStackHorizontally?: boolean;
    avatarSize?: ValueOf<typeof CONST.AVATAR_SIZE>;
    floatRightAvatars?: TIcon[];
    title?: string;
    shouldShowRightIcon?: boolean;
    iconRight?: IconAsset;
    badgeText?: string;
    badgeStyle?: ViewStyle;
};

type Menu = {sectionStyle: StyleProp<ViewStyle>; sectionTranslationKey: TranslationPaths; items: MenuData[]};

function InitialSettingsPage({currentUserPersonalDetails}: InitialSettingsPageProps) {
    const [userWallet] = useOnyx(ONYXKEYS.USER_WALLET);
    const [bankAccountList] = useOnyx(ONYXKEYS.BANK_ACCOUNT_LIST);
    const [fundList] = useOnyx(ONYXKEYS.FUND_LIST);
    const [walletTerms] = useOnyx(ONYXKEYS.WALLET_TERMS);
    const [loginList] = useOnyx(ONYXKEYS.LOGIN_LIST);
    const [policies] = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);
    const [tryNewDot] = useOnyx(ONYXKEYS.NVP_TRYNEWDOT);

    const [isActingAsDelegate] = useOnyx(ONYXKEYS.ACCOUNT, {selector: (account) => !!account?.delegatedAccess?.delegate});

    const [isNoDelegateAccessMenuVisible, setIsNoDelegateAccessMenuVisible] = useState(false);

    const network = useNetwork();
    const theme = useTheme();
    const styles = useThemeStyles();
    const {isExecuting, singleExecution} = useSingleExecution();
    const waitForNavigate = useWaitForNavigation();
    const popoverAnchor = useRef(null);
    const {translate} = useLocalize();
    const activeCentralPaneRoute = useActiveCentralPaneRoute();
    const emojiCode = currentUserPersonalDetails?.status?.emojiCode ?? '';
    const [allConnectionSyncProgresses] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CONNECTION_SYNC_PROGRESS}`);
    const {setInitialURL} = useContext(InitialURLContext);

    const [privateSubscription] = useOnyx(ONYXKEYS.NVP_PRIVATE_SUBSCRIPTION);
    const subscriptionPlan = useSubscriptionPlan();

    const [shouldShowSignoutConfirmModal, setShouldShowSignoutConfirmModal] = useState(false);

    const freeTrialText = getFreeTrialText(policies);
    const shouldOpenBookACall = tryNewDot?.classicRedirect?.dismissed === false;

    useEffect(() => {
        openInitialSettingsPage();
        confirmReadyToOpenApp();
    }, []);

    const toggleSignoutConfirmModal = (value: boolean) => {
        setShouldShowSignoutConfirmModal(value);
    };

    const signOut = useCallback(
        (shouldForceSignout = false) => {
            if (!network.isOffline || shouldForceSignout) {
                signOutAndRedirectToSignIn();
                return;
            }

            // When offline, warn the user that any actions they took while offline will be lost if they sign out
            toggleSignoutConfirmModal(true);
        },
        [network.isOffline],
    );

    /**
     * Retuns a list of menu items data for account section
     * @returns object with translationKey, style and items for the account section
     */
    const accountMenuItemsData: Menu = useMemo(() => {
        const profileBrickRoadIndicator = getProfilePageBrickRoadIndicator(loginList, privatePersonalDetails);
        const paymentCardList = fundList;
        const defaultMenu: Menu = {
            sectionStyle: styles.accountSettingsSectionContainer,
            sectionTranslationKey: 'initialSettingsPage.account',
            items: [
                {
                    translationKey: 'common.profile',
                    icon: Expensicons.Profile,
                    routeName: ROUTES.SETTINGS_PROFILE,
                    brickRoadIndicator: profileBrickRoadIndicator,
                },
                {
                    translationKey: 'common.wallet',
                    icon: Expensicons.Wallet,
                    routeName: ROUTES.SETTINGS_WALLET,
                    brickRoadIndicator:
                        hasPaymentMethodError(bankAccountList, paymentCardList) || !isEmptyObject(userWallet?.errors) || !isEmptyObject(walletTerms?.errors) ? 'error' : undefined,
                },
                {
                    translationKey: 'common.preferences',
                    icon: Expensicons.Gear,
                    routeName: ROUTES.SETTINGS_PREFERENCES,
                },
                {
                    translationKey: 'initialSettingsPage.security',
                    icon: Expensicons.Lock,
                    routeName: ROUTES.SETTINGS_SECURITY,
                },
            ],
        };

        return defaultMenu;
    }, [loginList, fundList, styles.accountSettingsSectionContainer, bankAccountList, userWallet?.errors, walletTerms?.errors, privatePersonalDetails]);

    /**
     * Retuns a list of menu items data for workspace section
     * @returns object with translationKey, style and items for the workspace section
     */
    const workspaceMenuItemsData: Menu = useMemo(() => {
        const items: MenuData[] = [
            {
                translationKey: 'common.workspaces',
                icon: Expensicons.Buildings,
                routeName: ROUTES.SETTINGS_WORKSPACES,
                brickRoadIndicator: hasGlobalWorkspaceSettingsRBR(policies, allConnectionSyncProgresses) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            },
            {
                translationKey: 'allSettingsScreen.domains',
                icon: Expensicons.Globe,
                action: () => {
                    openOldDotLink(CONST.OLDDOT_URLS.ADMIN_DOMAINS_URL);
                },
                shouldShowRightIcon: true,
                iconRight: Expensicons.NewWindow,
                link: () => buildOldDotURL(CONST.OLDDOT_URLS.ADMIN_DOMAINS_URL),
            },
        ];

        if (subscriptionPlan) {
            items.splice(1, 0, {
                translationKey: 'allSettingsScreen.subscription',
                icon: Expensicons.CreditCard,
                routeName: ROUTES.SETTINGS_SUBSCRIPTION,
                brickRoadIndicator: !!privateSubscription?.errors || hasSubscriptionRedDotError() ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
                badgeText: freeTrialText,
                badgeStyle: freeTrialText ? styles.badgeSuccess : undefined,
            });
        }

        return {
            sectionStyle: styles.workspaceSettingsSectionContainer,
            sectionTranslationKey: 'common.workspaces',
            items,
        };
    }, [allConnectionSyncProgresses, freeTrialText, policies, privateSubscription?.errors, styles.badgeSuccess, styles.workspaceSettingsSectionContainer, subscriptionPlan]);

    /**
     * Retuns a list of menu items data for general section
     * @returns object with translationKey, style and items for the general section
     */
    const generalMenuItemsData: Menu = useMemo(() => {
        const signOutTranslationKey = isSupportAuthToken() ? 'initialSettingsPage.restoreStashed' : 'initialSettingsPage.signOut';
        return {
            sectionStyle: {
                ...styles.pt4,
            },
            sectionTranslationKey: 'initialSettingsPage.general',
            items: [
                {
                    translationKey: 'initialSettingsPage.help',
                    icon: Expensicons.QuestionMark,
                    action: () => {
                        openExternalLink(CONST.NEWHELP_URL);
                    },
                    iconRight: Expensicons.NewWindow,
                    shouldShowRightIcon: true,
                    link: CONST.NEWHELP_URL,
                },
                {
                    translationKey: 'exitSurvey.goToExpensifyClassic',
                    icon: Expensicons.ExpensifyLogoNew,
                    ...(NativeModules.HybridAppModule
                        ? {
                              action: () => {
                                  NativeModules.HybridAppModule.closeReactNativeApp(false, true);
                                  setInitialURL(undefined);
                              },
                          }
                        : {
                              action() {
                                  if (isActingAsDelegate) {
                                      setIsNoDelegateAccessMenuVisible(true);
                                      return;
                                  }
                                  resetExitSurveyForm(() => {
                                      if (shouldOpenBookACall) {
                                          Navigation.navigate(ROUTES.SETTINGS_EXIT_SURVERY_BOOK_CALL.route);
                                          return;
                                      }
                                      Navigation.navigate(ROUTES.SETTINGS_EXIT_SURVEY_CONFIRM.route);
                                  });
                              },
                          }),
                },
                {
                    translationKey: 'initialSettingsPage.about',
                    icon: Expensicons.Info,
                    routeName: ROUTES.SETTINGS_ABOUT,
                },
                {
                    translationKey: 'initialSettingsPage.aboutPage.troubleshoot',
                    icon: Expensicons.Lightbulb,
                    routeName: ROUTES.SETTINGS_TROUBLESHOOT,
                },
                {
                    translationKey: 'sidebarScreen.saveTheWorld',
                    icon: Expensicons.Heart,
                    routeName: ROUTES.SETTINGS_SAVE_THE_WORLD,
                },
                {
                    translationKey: signOutTranslationKey,
                    icon: Expensicons.Exit,
                    action: () => {
                        signOut(false);
                    },
                },
            ],
        };
    }, [styles.pt4, signOut, setInitialURL, shouldOpenBookACall, isActingAsDelegate]);

    /**
     * Retuns JSX.Element with menu items
     * @param menuItemsData list with menu items data
     * @returns the menu items for passed data
     */
    const getMenuItemsSection = useCallback(
        (menuItemsData: Menu) => {
            /**
             * @param isPaymentItem whether the item being rendered is the payments menu item
             * @returns the user's wallet balance
             */
            const getWalletBalance = (isPaymentItem: boolean): string | undefined => (isPaymentItem ? convertToDisplayString(userWallet?.currentBalance) : undefined);

            const openPopover = (link: string | (() => Promise<string>) | undefined, event: GestureResponderEvent | MouseEvent) => {
                if (typeof link === 'function') {
                    link?.()?.then((url) => ReportActionContextMenu.showContextMenu(CONST.CONTEXT_MENU_TYPES.LINK, event, url, popoverAnchor.current));
                } else if (link) {
                    ReportActionContextMenu.showContextMenu(CONST.CONTEXT_MENU_TYPES.LINK, event, link, popoverAnchor.current);
                }
            };

            return (
                <View style={[menuItemsData.sectionStyle, styles.pb4, styles.mh3]}>
                    <Text style={styles.sectionTitle}>{translate(menuItemsData.sectionTranslationKey)}</Text>
                    {menuItemsData.items.map((item) => {
                        const keyTitle = item.translationKey ? translate(item.translationKey) : item.title;
                        const isPaymentItem = item.translationKey === 'common.wallet';

                        return (
                            <MenuItem
                                key={keyTitle}
                                wrapperStyle={styles.sectionMenuItem}
                                title={keyTitle}
                                icon={item.icon}
                                iconType={item.iconType}
                                disabled={isExecuting}
                                onPress={singleExecution(() => {
                                    if (item.action) {
                                        item.action();
                                    } else {
                                        waitForNavigate(() => {
                                            Navigation.navigate(item.routeName);
                                        })();
                                    }
                                })}
                                iconStyles={item.iconStyles}
                                badgeText={item.badgeText ?? getWalletBalance(isPaymentItem)}
                                badgeStyle={item.badgeStyle}
                                fallbackIcon={item.fallbackIcon}
                                brickRoadIndicator={item.brickRoadIndicator}
                                floatRightAvatars={item.floatRightAvatars}
                                shouldStackHorizontally={item.shouldStackHorizontally}
                                floatRightAvatarSize={item.avatarSize}
                                ref={popoverAnchor}
                                shouldBlockSelection={!!item.link}
                                onSecondaryInteraction={item.link ? (event) => openPopover(item.link, event) : undefined}
                                focused={
                                    !!activeCentralPaneRoute &&
                                    !!item.routeName &&
                                    !!(activeCentralPaneRoute.name.toLowerCase().replaceAll('_', '') === item.routeName.toLowerCase().replaceAll('/', ''))
                                }
                                iconRight={item.iconRight}
                                shouldShowRightIcon={item.shouldShowRightIcon}
                                shouldIconUseAutoWidthStyle
                            />
                        );
                    })}
                </View>
            );
        },
        [styles.pb4, styles.mh3, styles.sectionTitle, styles.sectionMenuItem, translate, userWallet?.currentBalance, isExecuting, singleExecution, activeCentralPaneRoute, waitForNavigate],
    );

    const accountMenuItems = useMemo(() => getMenuItemsSection(accountMenuItemsData), [accountMenuItemsData, getMenuItemsSection]);
    const generalMenuItems = useMemo(() => getMenuItemsSection(generalMenuItemsData), [generalMenuItemsData, getMenuItemsSection]);
    const workspaceMenuItems = useMemo(() => getMenuItemsSection(workspaceMenuItemsData), [workspaceMenuItemsData, getMenuItemsSection]);

    const headerContent = (
        <View style={[styles.ph5, styles.pv5]}>
            {isEmptyObject(currentUserPersonalDetails) || currentUserPersonalDetails.displayName === undefined ? (
                <AccountSwitcherSkeletonView avatarSize={CONST.AVATAR_SIZE.DEFAULT} />
            ) : (
                <View style={[styles.flexRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.gap3]}>
                    <AccountSwitcher />
                    <Tooltip text={translate('statusPage.status')}>
                        <PressableWithFeedback
                            accessibilityLabel={translate('statusPage.status')}
                            accessibilityRole="button"
                            accessible
                            onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS)}
                        >
                            <View style={styles.primaryMediumIcon}>
                                {emojiCode ? (
                                    <Text style={styles.primaryMediumText}>{emojiCode}</Text>
                                ) : (
                                    <Icon
                                        src={Expensicons.Emoji}
                                        width={variables.iconSizeNormal}
                                        height={variables.iconSizeNormal}
                                        fill={theme.icon}
                                    />
                                )}
                            </View>
                        </PressableWithFeedback>
                    </Tooltip>
                </View>
            )}
        </View>
    );

    const {saveScrollOffset, getScrollOffset} = useContext(ScrollOffsetContext);
    const route = useRoute();
    const scrollViewRef = useRef<RNScrollView>(null);

    const onScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
        (e) => {
            // If the layout measurement is 0, it means the flashlist is not displayed but the onScroll may be triggered with offset value 0.
            // We should ignore this case.
            if (e.nativeEvent.layoutMeasurement.height === 0) {
                return;
            }
            saveScrollOffset(route, e.nativeEvent.contentOffset.y);
        },
        [route, saveScrollOffset],
    );

    useLayoutEffect(() => {
        const scrollOffset = getScrollOffset(route);
        if (!scrollOffset || !scrollViewRef.current) {
            return;
        }
        scrollViewRef.current.scrollTo({y: scrollOffset, animated: false});
    }, [getScrollOffset, route]);

    return (
        <ScreenWrapper
            style={[styles.w100, styles.pb0]}
            includePaddingTop={false}
            includeSafeAreaPaddingBottom={false}
            testID={InitialSettingsPage.displayName}
            shouldEnableKeyboardAvoidingView={false}
        >
            {headerContent}
            <ScrollView
                ref={scrollViewRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.w100]}
                showsVerticalScrollIndicator={false}
            >
                {accountMenuItems}
                {workspaceMenuItems}
                {generalMenuItems}
                <ConfirmModal
                    danger
                    title={translate('common.areYouSure')}
                    prompt={translate('initialSettingsPage.signOutConfirmationText')}
                    confirmText={translate('initialSettingsPage.signOut')}
                    cancelText={translate('common.cancel')}
                    isVisible={shouldShowSignoutConfirmModal}
                    onConfirm={() => signOut(true)}
                    onCancel={() => toggleSignoutConfirmModal(false)}
                />
            </ScrollView>
            <DelegateNoAccessModal
                isNoDelegateAccessMenuVisible={isNoDelegateAccessMenuVisible}
                onClose={() => setIsNoDelegateAccessMenuVisible(false)}
            />
        </ScreenWrapper>
    );
}

InitialSettingsPage.displayName = 'InitialSettingsPage';

export default withCurrentUserPersonalDetails(InitialSettingsPage);
