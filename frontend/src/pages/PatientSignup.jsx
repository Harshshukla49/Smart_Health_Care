import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';
import { useI18n } from '../context/I18nContext';

export function PatientSignup() {
  const { t } = useI18n();
  return (
    <RoleLoginPage
      role="patient"
      mode="signup"
      title={t('auth.rolePage.patientSignupTitle')}
      subtitle={t('auth.rolePage.patientSignupSubtitle')}
      accent="text-[#1677FF]"
      helperCopy={t('auth.rolePage.patientAccountSignup')}
      ctaLabel={t('auth.signUp')}
    />
  );
}
