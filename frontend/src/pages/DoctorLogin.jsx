import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';

export function DoctorLogin() {
  return (
    <RoleLoginPage
      role="doctor"
      title="Doctor access for your clinical command center."
      subtitle="Log in to review patient load, vitals trends, and critical alerts from a premium healthcare dashboard."
      accent="text-fuchsia-300"
      helperCopy="Doctor portal login"
      ctaLabel="Login"
    />
  );
}
