import {useFocusEffect, useNavigationState} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import HighlightableMenuItem from '@components/HighlightableMenuItem';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import usePrevious from '@hooks/usePrevious';
import useSingleExecution from '@hooks/useSingleExecution';
import useThemeStyles from '@hooks/useThemeStyles';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import {isConnectionInProgress} from '@libs/actions/connections';
import * as CardUtils from '@libs/CardUtils';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import getTopmostRouteName from '@libs/Navigation/getTopmostRouteName';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import * as PolicyUtils from '@libs/PolicyUtils';
import {getDefaultWorkspaceAvatar, getIcons, getPolicyExpenseChat, getReportName, getReportOfflinePendingActionAndErrors} from '@libs/ReportUtils';
import type {FullScreenNavigatorParamList} from '@navigation/types';
import * as App from '@userActions/App';
import * as Policy from '@userActions/Policy/Policy';
import * as ReimbursementAccount from '@userActions/ReimbursementAccount';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {PendingAction} from '@src/types/onyx/OnyxCommon';
import type {PolicyFeatureName} from '@src/types/onyx/Policy';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';
import type {WithPolicyAndFullscreenLoadingProps} from './withPolicyAndFullscreenLoading';
import withPolicyAndFullscreenLoading from './withPolicyAndFullscreenLoading';

type WorkspaceMenuItem = {
    translationKey: TranslationPaths;
    icon: IconAsset;
    action: () => void;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>;
    routeName?:
        | typeof SCREENS.WORKSPACE.ACCOUNTING.ROOT
        | typeof SCREENS.WORKSPACE.INITIAL
        | typeof SCREENS.WORKSPACE.INVOICES
        | typeof SCREENS.WORKSPACE.DISTANCE_RATES
        | typeof SCREENS.WORKSPACE.WORKFLOWS
        | typeof SCREENS.WORKSPACE.CATEGORIES
        | typeof SCREENS.WORKSPACE.TAGS
        | typeof SCREENS.WORKSPACE.TAXES
        | typeof SCREENS.WORKSPACE.MORE_FEATURES
        | typeof SCREENS.WORKSPACE.PROFILE
        | typeof SCREENS.WORKSPACE.MEMBERS
        | typeof SCREENS.WORKSPACE.EXPENSIFY_CARD
        | typeof SCREENS.WORKSPACE.COMPANY_CARDS
        | typeof SCREENS.WORKSPACE.REPORT_FIELDS
        | typeof SCREENS.WORKSPACE.RULES
        | typeof SCREENS.WORKSPACE.PER_DIEM;
    badgeText?: string;
};

type WorkspaceInitialPageProps = WithPolicyAndFullscreenLoadingProps & PlatformStackScreenProps<FullScreenNavigatorParamList, typeof SCREENS.WORKSPACE.INITIAL>;

type PolicyFeatureStates = Record<PolicyFeatureName, boolean>;

function dismissError(policyID: string, pendingAction: PendingAction | undefined) {
    if (!policyID || pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        PolicyUtils.goBackFromInvalidPolicy();
        Policy.removeWorkspace(policyID);
    } else {
        Policy.clearErrors(policyID);
    }
}

function WorkspaceInitialPage({policyDraft, policy: policyProp, route}: WorkspaceInitialPageProps) {
    const styles = useThemeStyles();
    const policy = policyDraft?.id ? policyDraft : policyProp;
    const workspaceAccountID = PolicyUtils.getWorkspaceAccountID(policy?.id);
    const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
    const hasPolicyCreationError = !!(policy?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD && !isEmptyObject(policy.errors));
    const [cardFeeds] = useOnyx(`${ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER}${workspaceAccountID}`);
    const [cardSettings] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${workspaceAccountID}`);
    const [cardsList] = useOnyx(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${workspaceAccountID}_${CONST.EXPENSIFY_CARD.BANK}`);
    const [connectionSyncProgress] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CONNECTION_SYNC_PROGRESS}${policy?.id}`);
    const [currentUserLogin] = useOnyx(ONYXKEYS.SESSION, {selector: (session) => session?.email});
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${route.params?.policyID}`);
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST);
    const {login, accountID} = useCurrentUserPersonalDetails();
    const hasSyncError = PolicyUtils.shouldShowSyncError(policy, isConnectionInProgress(connectionSyncProgress, policy));
    const waitForNavigate = useWaitForNavigation();
    const {singleExecution, isExecuting} = useSingleExecution();
    const activeRoute = useNavigationState(getTopmostRouteName);
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const wasRendered = useRef(false);
    const currentUserPolicyExpenseChatReportID = getPolicyExpenseChat(accountID, policy?.id)?.reportID;
    const [currentUserPolicyExpenseChat] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${currentUserPolicyExpenseChatReportID}`);
    const {reportPendingAction} = getReportOfflinePendingActionAndErrors(currentUserPolicyExpenseChat);
    const isPolicyExpenseChatEnabled = !!policy?.isPolicyExpenseChatEnabled;
    const prevPendingFields = usePrevious(policy?.pendingFields);
    const policyFeatureStates = useMemo(
        () => ({
            [CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED]: policy?.areDistanceRatesEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED]: policy?.areWorkflowsEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED]: policy?.areCategoriesEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED]: policy?.areTagsEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED]: policy?.tax?.trackingEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED]: policy?.areCompanyCardsEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED]: !!policy?.areConnectionsEnabled || !isEmptyObject(policy?.connections),
            [CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED]: policy?.areExpensifyCardsEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_REPORT_FIELDS_ENABLED]: policy?.areReportFieldsEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED]: policy?.areRulesEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED]: policy?.areInvoicesEnabled,
            [CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED]: policy?.arePerDiemRatesEnabled,
        }),
        [policy],
    ) as PolicyFeatureStates;

    const fetchPolicyData = useCallback(() => {
        if (policyDraft?.id) {
            return;
        }
        Policy.openPolicyInitialPage(route.params.policyID);
    }, [policyDraft?.id, route.params.policyID]);

    useNetwork({onReconnect: fetchPolicyData});

    useFocusEffect(
        useCallback(() => {
            fetchPolicyData();
        }, [fetchPolicyData]),
    );

    const policyID = `${policy?.id ?? CONST.DEFAULT_NUMBER_ID}`;
    const policyName = policy?.name ?? '';
    useEffect(() => {
        if (!isCurrencyModalOpen || policy?.outputCurrency !== CONST.CURRENCY.USD) {
            return;
        }
        setIsCurrencyModalOpen(false);
    }, [policy?.outputCurrency, isCurrencyModalOpen]);

    /** Call update workspace currency and hide the modal */
    const confirmCurrencyChangeAndHideModal = useCallback(() => {
        Policy.updateGeneralSettings(policyID, policyName, CONST.CURRENCY.USD);
        setIsCurrencyModalOpen(false);
        ReimbursementAccount.navigateToBankAccountRoute(policyID);
    }, [policyID, policyName]);

    const hasMembersError = PolicyUtils.shouldShowEmployeeListError(policy);
    const hasPolicyCategoryError = PolicyUtils.hasPolicyCategoriesError(policyCategories);
    const hasGeneralSettingsError =
        !isEmptyObject(policy?.errorFields?.name ?? {}) ||
        !isEmptyObject(policy?.errorFields?.avatarURL ?? {}) ||
        !isEmptyObject(policy?.errorFields?.ouputCurrency ?? {}) ||
        !isEmptyObject(policy?.errorFields?.address ?? {});
    const shouldShowProtectedItems = PolicyUtils.isPolicyAdmin(policy, login);
    const isPaidGroupPolicy = PolicyUtils.isPaidGroupPolicy(policy);
    const [featureStates, setFeatureStates] = useState(policyFeatureStates);

    const protectedCollectPolicyMenuItems: WorkspaceMenuItem[] = [];

    // We only update feature states if they aren't pending.
    // These changes are made to synchronously change feature states along with AccessOrNotFoundWrapperComponent.
    useEffect(() => {
        setFeatureStates((currentFeatureStates) => {
            const newFeatureStates = {} as PolicyFeatureStates;
            (Object.keys(policy?.pendingFields ?? {}) as PolicyFeatureName[]).forEach((key) => {
                const isFeatureEnabled = PolicyUtils.isPolicyFeatureEnabled(policy, key);
                newFeatureStates[key] =
                    prevPendingFields?.[key] !== policy?.pendingFields?.[key] || isOffline || !policy?.pendingFields?.[key] ? isFeatureEnabled : currentFeatureStates[key];
            });
            return {
                ...policyFeatureStates,
                ...newFeatureStates,
            };
        });
    }, [policy, isOffline, policyFeatureStates, prevPendingFields]);

    useEffect(() => {
        App.confirmReadyToOpenApp();
    }, []);

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.distanceRates',
            icon: Expensicons.Car,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_DISTANCE_RATES.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.DISTANCE_RATES,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.expensifyCard',
            icon: Expensicons.ExpensifyCard,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.EXPENSIFY_CARD,
            brickRoadIndicator: !isEmptyObject(cardsList?.cardList?.errorFields ?? {}) || !isEmptyObject(cardSettings?.errors ?? {}) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED]) {
        const hasPolicyFeedsError = PolicyUtils.hasPolicyFeedsError(CardUtils.getCompanyFeeds(cardFeeds));

        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.companyCards',
            icon: Expensicons.CreditCard,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.COMPANY_CARDS,
            brickRoadIndicator: hasPolicyFeedsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'common.perDiem',
            icon: Expensicons.CalendarSolid,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_PER_DIEM.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.PER_DIEM,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.workflows',
            icon: Expensicons.Workflows,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.WORKFLOWS,
            brickRoadIndicator: !isEmptyObject(policy?.errorFields?.reimburser ?? {}) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.rules',
            icon: Expensicons.Feed,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_RULES.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.RULES,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED]) {
        const currencyCode = policy?.outputCurrency ?? CONST.CURRENCY.USD;

        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.invoices',
            icon: Expensicons.InvoiceGeneric,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_INVOICES.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.INVOICES,
            badgeText: CurrencyUtils.convertToDisplayString(policy?.invoice?.bankAccount?.stripeConnectAccountBalance ?? 0, currencyCode),
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.categories',
            icon: Expensicons.Folder,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_CATEGORIES.getRoute(policyID)))),
            brickRoadIndicator: hasPolicyCategoryError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            routeName: SCREENS.WORKSPACE.CATEGORIES,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.tags',
            icon: Expensicons.Tag,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_TAGS.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.TAGS,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.taxes',
            icon: Expensicons.Coins,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_TAXES.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.TAXES,
            brickRoadIndicator: PolicyUtils.shouldShowTaxRateError(policy) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_REPORT_FIELDS_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.reportFields',
            icon: Expensicons.Pencil,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_REPORT_FIELDS.getRoute(policyID)))),
            routeName: SCREENS.WORKSPACE.REPORT_FIELDS,
        });
    }

    if (featureStates?.[CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED]) {
        protectedCollectPolicyMenuItems.push({
            translationKey: 'workspace.common.accounting',
            icon: Expensicons.Sync,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.POLICY_ACCOUNTING.getRoute(policyID)))),
            brickRoadIndicator: hasSyncError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            routeName: SCREENS.WORKSPACE.ACCOUNTING.ROOT,
        });
    }

    protectedCollectPolicyMenuItems.push({
        translationKey: 'workspace.common.moreFeatures',
        icon: Expensicons.Gear,
        action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID)))),
        routeName: SCREENS.WORKSPACE.MORE_FEATURES,
    });

    const menuItems: WorkspaceMenuItem[] = [
        {
            translationKey: 'workspace.common.profile',
            icon: Expensicons.Building,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_PROFILE.getRoute(policyID)))),
            brickRoadIndicator: hasGeneralSettingsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            routeName: SCREENS.WORKSPACE.PROFILE,
        },
        {
            translationKey: 'workspace.common.members',
            icon: Expensicons.Users,
            action: singleExecution(waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_MEMBERS.getRoute(policyID)))),
            brickRoadIndicator: hasMembersError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            routeName: SCREENS.WORKSPACE.MEMBERS,
        },
        ...(isPaidGroupPolicy && shouldShowProtectedItems ? protectedCollectPolicyMenuItems : []),
    ];

    const prevPolicy = usePrevious(policy);
    const prevProtectedMenuItems = usePrevious(protectedCollectPolicyMenuItems);
    const enabledItem = protectedCollectPolicyMenuItems.find((curItem) => !prevProtectedMenuItems.some((prevItem) => curItem.routeName === prevItem.routeName));

    const shouldShowPolicy = useMemo(() => PolicyUtils.shouldShowPolicy(policy, isOffline, currentUserLogin), [policy, isOffline, currentUserLogin]);
    const prevShouldShowPolicy = useMemo(() => PolicyUtils.shouldShowPolicy(prevPolicy, isOffline, currentUserLogin), [prevPolicy, isOffline, currentUserLogin]);
    // We check shouldShowPolicy and prevShouldShowPolicy to prevent the NotFound view from showing right after we delete the workspace
    // eslint-disable-next-line rulesdir/no-negated-variables
    const shouldShowNotFoundPage = isEmptyObject(policy) || (!shouldShowPolicy && !prevShouldShowPolicy);

    useEffect(() => {
        if (isEmptyObject(prevPolicy) || PolicyUtils.isPendingDeletePolicy(prevPolicy) || !PolicyUtils.isPendingDeletePolicy(policy)) {
            return;
        }
        PolicyUtils.goBackFromInvalidPolicy();
    }, [policy, prevPolicy]);

    // We are checking if the user can access the route.
    // If user can't access the route, we are dismissing any modals that are open when the NotFound view is shown
    const canAccessRoute = activeRoute && (menuItems.some((item) => item.routeName === activeRoute) || activeRoute === SCREENS.WORKSPACE.INITIAL);

    useEffect(() => {
        if (!shouldShowNotFoundPage && canAccessRoute) {
            return;
        }
        if (wasRendered.current) {
            return;
        }
        wasRendered.current = true;
        // We are dismissing any modals that are open when the NotFound view is shown
        Navigation.isNavigationReady().then(() => {
            Navigation.closeRHPFlow();
        });
    }, [canAccessRoute, shouldShowNotFoundPage]);

    const policyAvatar = useMemo(() => {
        if (!policy) {
            return {source: Expensicons.ExpensifyAppIcon, name: CONST.WORKSPACE_SWITCHER.NAME, type: CONST.ICON_TYPE_AVATAR};
        }

        const avatar = policy?.avatarURL ? policy.avatarURL : getDefaultWorkspaceAvatar(policy?.name);
        return {
            source: avatar,
            name: policy?.name ?? '',
            type: CONST.ICON_TYPE_WORKSPACE,
            id: policy.id,
        };
    }, [policy]);

    return (
        <ScreenWrapper
            testID={WorkspaceInitialPage.displayName}
            includeSafeAreaPaddingBottom={false}
        >
            <FullPageNotFoundView
                onBackButtonPress={Navigation.dismissModal}
                onLinkPress={Navigation.resetToHome}
                shouldShow={shouldShowNotFoundPage}
                subtitleKey={shouldShowPolicy ? 'workspace.common.notAuthorized' : undefined}
            >
                <HeaderWithBackButton
                    title={policyName}
                    onBackButtonPress={() => {
                        if (route.params?.backTo) {
                            Navigation.resetToHome();
                            Navigation.isNavigationReady().then(() => Navigation.navigate(route.params?.backTo as Route));
                        } else {
                            Navigation.dismissModal();
                        }
                    }}
                    policyAvatar={policyAvatar}
                    style={styles.headerBarDesktopHeight}
                />

                <ScrollView contentContainerStyle={[styles.flexColumn]}>
                    <OfflineWithFeedback
                        pendingAction={policy?.pendingAction}
                        onClose={() => dismissError(policyID, policy?.pendingAction)}
                        errors={policy?.errors}
                        errorRowStyles={[styles.ph5, styles.pv2]}
                        shouldDisableStrikeThrough={false}
                        shouldHideOnDelete={false}
                    >
                        <View style={[styles.pb4, styles.mh3, styles.mt3]}>
                            {/*
                                Ideally we should use MenuList component for MenuItems with singleExecution/Navigation actions.
                                In this case where user can click on workspace avatar or menu items, we need to have a check for `isExecuting`. So, we are directly mapping menuItems.
                            */}
                            {menuItems.map((item) => (
                                <HighlightableMenuItem
                                    key={item.translationKey}
                                    disabled={hasPolicyCreationError || isExecuting}
                                    interactive={!hasPolicyCreationError}
                                    title={translate(item.translationKey)}
                                    icon={item.icon}
                                    onPress={item.action}
                                    brickRoadIndicator={item.brickRoadIndicator}
                                    wrapperStyle={styles.sectionMenuItem}
                                    highlighted={enabledItem?.routeName === item.routeName}
                                    focused={!!(item.routeName && activeRoute?.startsWith(item.routeName))}
                                    badgeText={item.badgeText}
                                    shouldIconUseAutoWidthStyle
                                />
                            ))}
                        </View>
                    </OfflineWithFeedback>
                    {isPolicyExpenseChatEnabled && (
                        <View style={[styles.pb4, styles.mh3, styles.mt3]}>
                            <Text style={[styles.textSupporting, styles.fontSizeLabel, styles.ph2]}>{translate('workspace.common.submitExpense')}</Text>
                            <OfflineWithFeedback pendingAction={reportPendingAction}>
                                <MenuItem
                                    title={getReportName(currentUserPolicyExpenseChat)}
                                    description={translate('workspace.common.workspace')}
                                    icon={getIcons(currentUserPolicyExpenseChat, personalDetails)}
                                    onPress={() =>
                                        Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(`${currentUserPolicyExpenseChat?.reportID ?? CONST.DEFAULT_NUMBER_ID}`), CONST.NAVIGATION.TYPE.UP)
                                    }
                                    shouldShowRightIcon
                                    wrapperStyle={[styles.br2, styles.pl2, styles.pr0, styles.pv3, styles.mt1, styles.alignItemsCenter]}
                                    shouldShowSubscriptAvatar
                                />
                            </OfflineWithFeedback>
                        </View>
                    )}
                </ScrollView>
                <ConfirmModal
                    title={translate('workspace.bankAccount.workspaceCurrency')}
                    isVisible={isCurrencyModalOpen}
                    onConfirm={confirmCurrencyChangeAndHideModal}
                    onCancel={() => setIsCurrencyModalOpen(false)}
                    prompt={translate('workspace.bankAccount.updateCurrencyPrompt')}
                    confirmText={translate('workspace.bankAccount.updateToUSD')}
                    cancelText={translate('common.cancel')}
                    danger
                />
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

WorkspaceInitialPage.displayName = 'WorkspaceInitialPage';

export default withPolicyAndFullscreenLoading(WorkspaceInitialPage);
