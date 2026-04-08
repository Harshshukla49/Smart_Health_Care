import React from 'react';
import { RoleLoginPage } from '../components/RoleLoginPage';

export function PatientSignup() {
  return (
    <RoleLoginPage
      role="patient"
      mode="signup"
      title="Create your patient account in minutes."
      subtitle="Sign up to view your latest vitals, care notes, and monitoring status from one secure patient workspace."
      accent="text-cyan-300"
      helperCopy="Patient account signup"
      ctaLabel="Sign up"
    />
  );
}
