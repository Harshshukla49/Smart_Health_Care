import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';

export function DoctorSignup() {
  return (
    <RoleLoginPage
      role="doctor"
      mode="signup"
      title="Create your doctor account for clinical access."
      subtitle="Sign up to monitor patient load, review trends, and respond to critical alerts from the clinical dashboard."
      accent="text-fuchsia-300"
      helperCopy="Doctor account signup"
      ctaLabel="Sign up"
    />
  );
}
