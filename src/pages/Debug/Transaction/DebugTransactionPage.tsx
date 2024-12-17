import React, {useCallback, useMemo} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Debug from '@libs/actions/Debug';
import DebugUtils from '@libs/DebugUtils';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import type {DebugTabNavigatorRoutes} from '@libs/Navigation/DebugTabNavigator';
import DebugTabNavigator from '@libs/Navigation/DebugTabNavigator';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {DebugParamList} from '@libs/Navigation/types';
import DebugDetails from '@pages/Debug/DebugDetails';
import DebugJSON from '@pages/Debug/DebugJSON';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import DebugTransactionViolations from './DebugTransactionViolations';

type DebugTransactionPageProps = PlatformStackScreenProps<DebugParamList, typeof SCREENS.DEBUG.TRANSACTION>;

function DebugTransactionPage({
    route: {
        params: {transactionID},
    },
}: DebugTransactionPageProps) {
    const {translate} = useLocalize();
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`);
    const styles = useThemeStyles();

    const DebugDetailsTab = useCallback(
        () => (
            <DebugDetails
                formType={CONST.DEBUG.FORMS.TRANSACTION}
                data={transaction}
                onSave={(data) => {
                    Debug.setDebugData(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, data);
                }}
                onDelete={() => {
                    Debug.setDebugData(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, null);
                    Navigation.goBack();
                }}
                validate={DebugUtils.validateTransactionDraftProperty}
            >
                <View style={[styles.mh5, styles.mb5]}>
                    <Button
                        text={translate('debug.viewReport')}
                        onPress={() => {
                            Navigation.navigate(ROUTES.DEBUG_REPORT.getRoute(transaction?.reportID ?? ''));
                        }}
                    />
                </View>
            </DebugDetails>
        ),
        [styles.mb5, styles.mh5, transaction, transactionID, translate],
    );

    const DebugJSONTab = useCallback(() => <DebugJSON data={transaction ?? {}} />, [transaction]);

    const DebugTransactionViolationsTab = useCallback(() => <DebugTransactionViolations transactionID={transactionID} />, [transactionID]);

    const routes = useMemo<DebugTabNavigatorRoutes>(
        () => [
            {name: CONST.DEBUG.DETAILS, component: DebugDetailsTab},
            {name: CONST.DEBUG.JSON, component: DebugJSONTab},
            {name: CONST.DEBUG.TRANSACTION_VIOLATIONS, component: DebugTransactionViolationsTab},
        ],
        [DebugDetailsTab, DebugJSONTab, DebugTransactionViolationsTab],
    );

    if (!transaction) {
        return <NotFoundPage />;
    }

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableKeyboardAvoidingView={false}
            shouldEnableMinHeight={DeviceCapabilities.canUseTouchScreen()}
            testID={DebugTransactionPage.displayName}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <View style={[styles.flex1, safeAreaPaddingBottomStyle]}>
                    <HeaderWithBackButton
                        title={`${translate('debug.debug')} - ${translate('debug.transaction')}`}
                        onBackButtonPress={Navigation.goBack}
                    />
                    <DebugTabNavigator
                        id={CONST.TAB.DEBUG_TAB_ID}
                        routes={routes}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
}

DebugTransactionPage.displayName = 'DebugTransactionPage';

export default DebugTransactionPage;
