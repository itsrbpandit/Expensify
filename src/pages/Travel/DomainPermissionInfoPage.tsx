import React from 'react';
import {View} from 'react-native-web';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import RenderHTML from '@components/RenderHTML';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';

function DomainPermissionInfoPage() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            testID={DomainPermissionInfoPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('travel.domainPermissionInfo.title')}
                onBackButtonPress={() => Navigation.goBack()}
            />
            <View style={[styles.mt3, styles.mr5, styles.mb5, styles.ml5]}>
                <RenderHTML html={translate('travel.domainPermissionInfo.restriction', {domain: 'domain.com'})} />
                <br />
                <RenderHTML html={translate('travel.domainPermissionInfo.accountantInvitation')} />
            </View>
        </ScreenWrapper>
    );
}

DomainPermissionInfoPage.displayName = 'DomainPermissionInfoPage';

export default DomainPermissionInfoPage;
