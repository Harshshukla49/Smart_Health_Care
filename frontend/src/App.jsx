import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { MainLayout } from './layouts/MainLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Blog } from './pages/Blog';
import { Contact } from './pages/Contact';
import { AddPatient } from './pages/AddPatient';
import { PatientDetails } from './pages/PatientDetails';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { LoginSelection } from './pages/LoginSelection';
import { PatientLogin } from './pages/PatientLogin';
import PatientWelcome from './pages/PatientWelcome';
import { DoctorLogin } from './pages/DoctorLogin';
import { SignupSelection } from './pages/SignupSelection';
import { PatientSignup } from './pages/PatientSignup';
import { DoctorSignup } from './pages/DoctorSignup';
import { getAuthSession } from './utils/auth';
import SplashScreen from './pages/SplashScreen';
import { VideoCallProvider } from './context/VideoCallContext';
import { VideoCallDialerModal } from './components/videocall/VideoCallDialerModal';
import { IncomingCallModal } from './components/videocall/IncomingCallModal';
import { ActiveVideoCallModal } from './components/videocall/ActiveVideoCallModal';

function AuthRoute({ children }) {
  const session = getAuthSession();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AuthenticatedRoute({ children }) {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Strict Role Route Guard
 * Prevents unauthorized roles (e.g. patients attempting to access doctor-only routes)
 */
function RoleRoute({ children, allowedRoles = [] }) {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    toast.error(
      `Access Denied: You are logged in as a ${session.role}. This clinical feature requires ${allowedRoles.join('/')} authorization.`,
      { duration: 4000 }
    );
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Scoped Patient Details Route Guard
 * Doctors can view any patient in their ward.
 * Patients can ONLY view their own personal medical record.
 */
function ScopedPatientDetailsRoute() {
  const { patientId } = useParams();
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const isDoctor = session.role === 'doctor';
  const selfPatientId = String(session.patientId || '').trim();
  const requestedId = String(patientId || '').trim();

  // Patients cannot view another patient's data
  if (!isDoctor && selfPatientId && requestedId && selfPatientId.toLowerCase() !== requestedId.toLowerCase()) {
    toast.error(
      'Access Denied: As a patient, you are strictly restricted to your own personal telemetry records.',
      { duration: 4000 }
    );
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <MainLayout>
      <PatientDetails />
    </MainLayout>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <VideoCallProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            backdropFilter: 'blur(18px)',
          },
        }}
      />

      {/* Clinical Telehealth Modals (Global Portals) */}
      <VideoCallDialerModal />
      <IncomingCallModal />
      <ActiveVideoCallModal />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
        >
          <Routes location={location}>
            <Route path="/" element={<SplashScreen />} />
            
            {/* Public Auth Routes */}
            <Route path="/login" element={<AuthRoute><LoginSelection /></AuthRoute>} />
            <Route path="/login/patient" element={<AuthRoute><PatientLogin /></AuthRoute>} />
            <Route path="/login/doctor" element={<AuthRoute><DoctorLogin /></AuthRoute>} />
            <Route path="/signup" element={<AuthRoute><SignupSelection /></AuthRoute>} />
            <Route path="/signup/patient" element={<AuthRoute><PatientSignup /></AuthRoute>} />
            <Route path="/signup/doctor" element={<AuthRoute><DoctorSignup /></AuthRoute>} />

            {/* Authenticated Routes */}
            <Route path="/dashboard" element={<AuthenticatedRoute><Dashboard /></AuthenticatedRoute>} />
            <Route path="/settings" element={<AuthenticatedRoute><Settings /></AuthenticatedRoute>} />
            <Route path="/chat" element={<AuthenticatedRoute><Chat /></AuthenticatedRoute>} />
            <Route path="/welcome" element={<PatientWelcome />} />
            <Route path="/dashboard/patient" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/doctor" element={<Navigate to="/dashboard" replace />} />

            {/* Informational Pages */}
            <Route path="/about" element={<MainLayout><About /></MainLayout>} />
            <Route path="/blog" element={<MainLayout><Blog /></MainLayout>} />
            <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />

            {/* DOCTOR ONLY: Add Patient Route */}
            <Route
              path="/add-patient"
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <AddPatient />
                </RoleRoute>
              }
            />

            {/* SCOPED: Patient Details Route (Doctor = all patients, Patient = self only) */}
            <Route
              path="/patients/:patientId"
              element={<ScopedPatientDetailsRoute />}
            />

            <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </VideoCallProvider>
  );
}
