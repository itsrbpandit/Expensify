import * as NativeNavigation from '@react-navigation/native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import Onyx from 'react-native-onyx';
import * as Report from '@libs/actions/Report';
import * as Localize from '@libs/Localize';
import TopBar from '@libs/Navigation/AppNavigator/createCustomBottomTabNavigator/TopBar';
import type Navigation from '@libs/Navigation/Navigation';
import WorkspaceSwitcherPage from '@pages/WorkspaceSwitcherPage';
import * as AppActions from '@userActions/App';
import * as User from '@userActions/User';
import App from '@src/App';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PolicyCollectionDataSet} from '@src/types/onyx/Policy';
import type {ReportCollectionDataSet} from '@src/types/onyx/Report';
import type {NativeNavigationMock} from '../../__mocks__/@react-navigation/native';
import * as LHNTestUtils from '../utils/LHNTestUtils';
import PusherHelper from '../utils/PusherHelper';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

const mockedNavigate = jest.fn();

// We need a large timeout here as we are lazy loading React Navigation screens and this test is running against the entire mounted App
jest.setTimeout(60000);

// Be sure to include the mocked Permissions and Expensicons libraries or else the beta tests won't work
jest.mock('@libs/Permissions');
jest.mock('@components/Icon/Expensicons');
jest.mock('@src/hooks/useActiveWorkspaceFromNavigationState');
jest.mock('@src/hooks/useResponsiveLayout');
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof Navigation>('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: () => jest.fn(),
        }),
        useIsFocused: () => true,
        useNavigationState: () => {},
        useRoute: () => mockedNavigate,
    };
});
TestHelper.setupApp();

async function navigateToWorkspaceSwitcher(): Promise<void> {
    const hintText = Localize.translateLocal('workspace.switcher.headerTitle');
    const optionRow = screen.queryByAccessibilityHint(hintText);
    if (optionRow) {
        fireEvent(optionRow, 'press');
    }
    await act(() => {
        (NativeNavigation as NativeNavigationMock).triggerTransitionEnd();
    });
    await waitForBatchedUpdatesWithAct();
}

async function signInAndGetApp(): Promise<void> {
    // Render the App and sign in as a test user.
    render(<App />);
    await waitForBatchedUpdatesWithAct();
    const hintText = Localize.translateLocal('loginForm.loginForm');
    const loginForm = await screen.findAllByLabelText(hintText);
    expect(loginForm).toHaveLength(1);

    await act(async () => {
        await TestHelper.signInWithTestUser(1, 'email1@test.com', undefined, undefined, 'One');
    });

    await waitForBatchedUpdatesWithAct();

    User.subscribeToUserEvents();

    await waitForBatchedUpdates();

    await act(() => {
        AppActions.setSidebarLoaded();
    });

    AppActions.setSidebarLoaded();

    await waitForBatchedUpdatesWithAct();
}

describe('WorkspaceSwitcherPage', () => {
    afterEach(async () => {
        await act(async () => {
            await Onyx.clear();

            // Unsubscribe to pusher channels
            PusherHelper.teardown();
        });

        await waitForBatchedUpdatesWithAct();

        jest.clearAllMocks();
    });

    beforeAll(() =>
        Onyx.init({
            keys: ONYXKEYS,
            safeEvictionKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        }),
    );

    beforeEach(() => {
        // Wrap Onyx each onyx action with waitForBatchedUpdates
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        // Initialize the network key for OfflineWithFeedback
    });

    it('triggers press on workspaces list item only once', async () => {
        await signInAndGetApp();
        // Given three unread reports in the recently updated order of 3, 2, 1
        const report1 = LHNTestUtils.getFakeReport([1, 2], 3);
        const report2 = LHNTestUtils.getFakeReport([1, 3], 2);
        const report3 = LHNTestUtils.getFakeReport([1, 4], 1);

        const policy1 = LHNTestUtils.getFakePolicy('1', 'Workspace A');
        const policy2 = LHNTestUtils.getFakePolicy('2', 'B');
        const policy3 = LHNTestUtils.getFakePolicy('3', 'C');

        // Each report has at least one ADD_COMMENT action so should be rendered in the LNH
        Report.addComment(report1.reportID, 'Hi, this is a comment');
        Report.addComment(report2.reportID, 'Hi, this is a comment');
        Report.addComment(report3.reportID, 'Hi, this is a comment');

        const reportCollectionDataSet: ReportCollectionDataSet = {
            [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
            [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
            [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
        };

        const policyCollectionDataSet: PolicyCollectionDataSet = {
            [`${ONYXKEYS.COLLECTION.POLICY}${policy1.id}`]: policy1,
            [`${ONYXKEYS.COLLECTION.POLICY}${policy2.id}`]: policy2,
            [`${ONYXKEYS.COLLECTION.POLICY}${policy3.id}`]: policy3,
        };

        render(<WorkspaceSwitcherPage />);
        return (
            waitForBatchedUpdates()
                .then(async () => {
                    render(<TopBar breadcrumbLabel={Localize.translateLocal('common.inbox')} />);
                    await waitForBatchedUpdatesWithAct();
                })
                // When Onyx is updated with the data and the sidebar re-renders
                .then(() =>
                    Onyx.multiSet({
                        [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                        [ONYXKEYS.PERSONAL_DETAILS_LIST]: LHNTestUtils.fakePersonalDetails,
                        [ONYXKEYS.IS_LOADING_APP]: false,
                        ...reportCollectionDataSet,
                        ...policyCollectionDataSet,
                    }),
                )

                // Then the component should be rendered with the mostly recently updated report first
                .then(async () => {
                    await navigateToWorkspaceSwitcher();
                })
                .then(async () => {
                    render(<WorkspaceSwitcherPage />);
                    await waitForBatchedUpdatesWithAct();
                })
                .then(() => {
                    const optionRow = screen.getByTestId('Workspace A');
                    expect(optionRow).toBeOnTheScreen();
                })
        );
    });
});
