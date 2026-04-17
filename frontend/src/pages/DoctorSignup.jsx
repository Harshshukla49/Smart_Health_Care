import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';
import { useI18n } from '../context/I18nContext';

export function DoctorSignup() {
  const { t } = useI18n();
  return (
    <RoleLoginPage
      role="doctor"
      mode="signup"
      title={t('auth.rolePage.doctorSignupTitle')}
      subtitle={t('auth.rolePage.doctorSignupSubtitle')}
      accent="text-fuchsia-300"
      helperCopy={t('auth.rolePage.doctorAccountSignup')}
      ctaLabel={t('auth.signUp')}
    />
  );
}
