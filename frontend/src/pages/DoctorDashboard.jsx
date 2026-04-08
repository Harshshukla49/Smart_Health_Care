import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { RoleDashboardContent } from '../components/RoleDashboardContent';

export function DoctorDashboard() {
  return (
    <DashboardLayout
      role="doctor"
      title="Doctor dashboard"
      subtitle="A premium clinical command center with vitals, triage hints, and quick access to live patient context."
    >
      <RoleDashboardContent role="doctor" />
    </DashboardLayout>
  );
}
