import React from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Breadcrumbs from '@components/Breadcrumbs';
import {PressableWithoutFeedback} from '@components/Pressable';
import SearchButton from '@components/Search/SearchRouter/SearchButton';
import Text from '@components/Text';
import WorkspaceSwitcherButton from '@components/WorkspaceSwitcherButton';
import useLocalize from '@hooks/useLocalize';
import usePolicy from '@hooks/usePolicy';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as SearchQueryUtils from '@libs/SearchQueryUtils';
import SignInButton from '@pages/home/sidebar/SignInButton';
import * as Session from '@userActions/Session';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import LoadingBar from '@components/LoadingBar';

type TopBarProps = {
    breadcrumbLabel: string;
    activeWorkspaceID?: string;
    shouldDisplaySearch?: boolean;
    shouldDisplayCancelSearch?: boolean;

    /**
     * Callback used to keep track of the workspace switching process in the BaseSidebarScreen.
     * Passed to the WorkspaceSwitcherButton component.
     */
    onSwitchWorkspace?: () => void;
};

function TopBar({breadcrumbLabel, activeWorkspaceID, shouldDisplaySearch = true, shouldDisplayCancelSearch = false, onSwitchWorkspace}: TopBarProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const policy = usePolicy(activeWorkspaceID);
    const [session] = useOnyx(ONYXKEYS.SESSION, {selector: (sessionValue) => sessionValue && {authTokenType: sessionValue.authTokenType}});
    const [isLoadingReportData] = useOnyx(ONYXKEYS.IS_LOADING_REPORT_DATA);
    const isAnonymousUser = Session.isAnonymousUser(session);

    const headerBreadcrumb = policy?.name
        ? {type: CONST.BREADCRUMB_TYPE.STRONG, text: policy.name}
        : {
              type: CONST.BREADCRUMB_TYPE.ROOT,
          };

    const displaySignIn = isAnonymousUser;
    const displaySearch = !isAnonymousUser && shouldDisplaySearch;

    return (
        <View style={styles.w100}>
            <View
                style={[styles.flexRow, styles.gap4, styles.mh3, styles.mv5, styles.alignItemsCenter, styles.justifyContentBetween]}
                dataSet={{dragArea: true}}
            >
                <View style={[styles.flex1, styles.flexRow, styles.alignItemsCenter, styles.ml2]}>
                    <WorkspaceSwitcherButton
                        policy={policy}
                        onSwitchWorkspace={onSwitchWorkspace}
                    />

                    <View style={[styles.ml3, styles.flex1]}>
                        <Breadcrumbs
                            breadcrumbs={[
                                headerBreadcrumb,
                                {
                                    text: breadcrumbLabel,
                                },
                            ]}
                        />
                    </View>
                </View>
                {displaySignIn && <SignInButton />}
                {shouldDisplayCancelSearch && (
                    <PressableWithoutFeedback
                        accessibilityLabel={translate('common.cancel')}
                        style={[styles.textBlue]}
                        onPress={() => {
                            Navigation.goBack(ROUTES.SEARCH_CENTRAL_PANE.getRoute({query: SearchQueryUtils.buildCannedSearchQuery()}));
                        }}
                    >
                        <Text style={[styles.textBlue]}>{translate('common.cancel')}</Text>
                    </PressableWithoutFeedback>
                )}
                {displaySearch && <SearchButton />}
            </View>
            <LoadingBar shouldShow={isLoadingReportData ?? false} />
        </View>
    );
}

TopBar.displayName = 'TopBar';

export default TopBar;
