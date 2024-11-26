import React, {useCallback, useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import PushRowWithModal from '@components/PushRowWithModal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import type {SubStepProps} from '@hooks/useSubStep/types';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import mapCurrencyToCountry from '@pages/ReimbursementAccount/utils/mapCurrencyToCountry';
import * as FormActions from '@userActions/FormActions';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import INPUT_IDS from '@src/types/form/ReimbursementAccountForm';

const {BANK_CURRENCY, DESTINATION_COUNTRY} = INPUT_IDS.ADDITIONAL_DATA;

function Confirmation({onNext}: SubStepProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const [reimbursementAccount] = useOnyx(ONYXKEYS.REIMBURSEMENT_ACCOUNT);
    const [reimbursementAccountDraft] = useOnyx(ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM_DRAFT);

    const policyID = reimbursementAccount?.achData?.policyID ?? '-1';
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const currency = policy?.outputCurrency ?? '';

    const shouldAllowChange = currency === CONST.CURRENCY.EUR;
    const currencyMappedToCountry = mapCurrencyToCountry(currency);

    const countryDefaultValue = reimbursementAccount?.achData?.additionalData?.[DESTINATION_COUNTRY] ?? reimbursementAccountDraft?.[DESTINATION_COUNTRY] ?? '';
    const [selectedCountry, setSelectedCountry] = useState<string>(countryDefaultValue);

    const disableSubmit = !(currency in CONST.CURRENCY);

    const handleSettingsPress = () => {
        Navigation.navigate(ROUTES.WORKSPACE_PROFILE.getRoute(policyID));
    };

    const handleSelectingCountry = (country: unknown) => {
        setSelectedCountry(typeof country === 'string' ? country : '');
    };

    const validate = useCallback((values: FormOnyxValues<typeof ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM>): FormInputErrors<typeof ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM> => {
        return ValidationUtils.getFieldRequiredErrors(values, [BANK_CURRENCY]);
    }, []);

    useEffect(() => {
        if (currency === CONST.CURRENCY.EUR) {
            if (countryDefaultValue !== '') {
                FormActions.setDraftValues(ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM, {[DESTINATION_COUNTRY]: countryDefaultValue});
                setSelectedCountry(countryDefaultValue);
            }
            return;
        }

        FormActions.setDraftValues(ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM, {[DESTINATION_COUNTRY]: currencyMappedToCountry, [BANK_CURRENCY]: currency});
        setSelectedCountry(currencyMappedToCountry);
    }, [countryDefaultValue, currency, currencyMappedToCountry]);

    return (
        <SafeAreaConsumer>
            {({safeAreaPaddingBottomStyle}) => (
                <ScrollView
                    style={styles.pt0}
                    contentContainerStyle={[styles.flexGrow1, safeAreaPaddingBottomStyle]}
                >
                    <Text style={[styles.textHeadlineLineHeightXXL, styles.ph5, styles.mb3]}>{translate('countryStep.confirmBusinessBank')}</Text>
                    <MenuItemWithTopDescription
                        description={translate('common.currency')}
                        title={currency}
                        interactive={false}
                    />
                    <Text style={[styles.ph5, styles.mb3, styles.mutedTextLabel]}>
                        {`${translate('countryStep.yourBusiness')} ${translate('countryStep.youCanChange')}`}
                        <PressableWithoutFeedback
                            accessibilityRole="button"
                            accessibilityLabel={translate('common.settings')}
                            accessible
                            onPress={handleSettingsPress}
                            style={styles.ml1}
                        >
                            <Text style={[styles.label, styles.textBlue]}>{translate('common.settings').toLowerCase()}</Text>
                        </PressableWithoutFeedback>
                        .
                    </Text>
                    <FormProvider
                        formID={ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM}
                        submitButtonText={translate('common.confirm')}
                        validate={validate}
                        onSubmit={onNext}
                        style={[styles.flexGrow1]}
                        submitButtonStyles={[styles.mh5, styles.pb0, styles.mbn1]}
                        isSubmitDisabled={disableSubmit}
                    >
                        <InputWrapper
                            InputComponent={PushRowWithModal}
                            optionsList={shouldAllowChange ? CONST.ALL_EUROPEAN_COUNTRIES : CONST.ALL_COUNTRIES}
                            onValueChange={handleSelectingCountry}
                            description={translate('common.country')}
                            modalHeaderTitle={translate('countryStep.selectCountry')}
                            searchInputTitle={translate('countryStep.findCountry')}
                            shouldAllowChange={shouldAllowChange}
                            value={selectedCountry}
                            inputID={BANK_CURRENCY}
                            shouldSaveDraft
                        />
                    </FormProvider>
                </ScrollView>
            )}
        </SafeAreaConsumer>
    );
}

Confirmation.displayName = 'Confirmation';

export default Confirmation;
