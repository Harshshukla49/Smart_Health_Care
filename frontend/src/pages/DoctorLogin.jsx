import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';
import { useI18n } from '../context/I18nContext';

export function DoctorLogin() {
  const { t } = useI18n();
  return (
    <RoleLoginPage
      role="doctor"
      title={t('auth.rolePage.doctorLoginTitle')}
      subtitle={t('auth.rolePage.doctorLoginSubtitle')}
      accent="text-fuchsia-300"
      helperCopy={t('auth.rolePage.doctorPortalLogin')}
      ctaLabel={t('auth.login')}
    />
  );
}
