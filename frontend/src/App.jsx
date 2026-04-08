import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MainLayout } from './layouts/MainLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Blog } from './pages/Blog';
import { Contact } from './pages/Contact';
import { AddPatient } from './pages/AddPatient';
import { PatientDetails } from './pages/PatientDetails';
import { NotFound } from './pages/NotFound';
import { LoginSelection } from './pages/LoginSelection';
import { PatientLogin } from './pages/PatientLogin';
import { DoctorLogin } from './pages/DoctorLogin';
import { SignupSelection } from './pages/SignupSelection';
import { PatientSignup } from './pages/PatientSignup';
import { DoctorSignup } from './pages/DoctorSignup';
import { PatientDashboard } from './pages/PatientDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { getAuthSession, getDashboardPathForRole } from './utils/auth';

function DashboardEntry() {
  const session = getAuthSession();
  return <Navigate to={session ? getDashboardPathForRole(session.role) : '/login'} replace />;
}

function AuthRoute({ children }) {
  const session = getAuthSession();

  if (session) {
    return <Navigate to={getDashboardPathForRole(session.role)} replace />;
  }

  return children;
}

function RoleDashboardRoute({ role, children }) {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== role) {
    return <Navigate to={getDashboardPathForRole(session.role)} replace />;
  }

  return children;
}

function DoctorOnlyRoute({ children }) {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== 'doctor') {
    return <Navigate to={getDashboardPathForRole(session.role)} replace />;
  }

  return children;
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.28, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<AuthRoute><LoginSelection /></AuthRoute>} />
          <Route path="/login/patient" element={<AuthRoute><PatientLogin /></AuthRoute>} />
          <Route path="/login/doctor" element={<AuthRoute><DoctorLogin /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><SignupSelection /></AuthRoute>} />
          <Route path="/signup/patient" element={<AuthRoute><PatientSignup /></AuthRoute>} />
          <Route path="/signup/doctor" element={<AuthRoute><DoctorSignup /></AuthRoute>} />
          <Route path="/dashboard" element={<DashboardEntry />} />
          <Route path="/dashboard/patient" element={<RoleDashboardRoute role="patient"><PatientDashboard /></RoleDashboardRoute>} />
          <Route path="/dashboard/doctor" element={<RoleDashboardRoute role="doctor"><DoctorDashboard /></RoleDashboardRoute>} />
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/about" element={<MainLayout><About /></MainLayout>} />
          <Route path="/blog" element={<MainLayout><Blog /></MainLayout>} />
          <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
          <Route path="/add-patient" element={<DoctorOnlyRoute><AddPatient /></DoctorOnlyRoute>} />
          <Route path="/patients/:patientId" element={<DoctorOnlyRoute><MainLayout><PatientDetails /></MainLayout></DoctorOnlyRoute>} />
          <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
