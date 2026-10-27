import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { MainLayout } from './layouts/MainLayout';
import { getAuthSession } from './utils/auth';
import { VideoCallProvider } from './context/VideoCallContext';
import { VideoCallDialerModal } from './components/videocall/VideoCallDialerModal';
import { IncomingCallModal } from './components/videocall/IncomingCallModal';
import { ActiveVideoCallModal } from './components/videocall/ActiveVideoCallModal';
import { EmergencyProvider } from './context/EmergencyContext';
import { PwaProvider } from './context/PwaContext';
import { IosInstallModal } from './components/pwa/IosInstallModal';
import { PwaFloatingBanner } from './components/pwa/PwaFloatingBanner';

// Route-level Code Splitting with React.lazy for sub-second bundle delivery
const SplashScreen = lazy(() => import('./pages/SplashScreen'));
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Blog = lazy(() => import('./pages/Blog').then((m) => ({ default: m.Blog })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const AddPatient = lazy(() => import('./pages/AddPatient').then((m) => ({ default: m.AddPatient })));
const PatientDetails = lazy(() => import('./pages/PatientDetails').then((m) => ({ default: m.PatientDetails })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Chat = lazy(() => import('./pages/Chat').then((m) => ({ default: m.Chat })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const LoginSelection = lazy(() => import('./pages/LoginSelection').then((m) => ({ default: m.LoginSelection })));
const PatientLogin = lazy(() => import('./pages/PatientLogin').then((m) => ({ default: m.PatientLogin })));
const PatientWelcome = lazy(() => import('./pages/PatientWelcome'));
const DoctorLogin = lazy(() => import('./pages/DoctorLogin').then((m) => ({ default: m.DoctorLogin })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const SignupSelection = lazy(() => import('./pages/SignupSelection').then((m) => ({ default: m.SignupSelection })));
const PatientSignup = lazy(() => import('./pages/PatientSignup').then((m) => ({ default: m.PatientSignup })));
const DoctorSignup = lazy(() => import('./pages/DoctorSignup').then((m) => ({ default: m.DoctorSignup })));

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4 text-slate-400"
    >
      <div className="w-8 h-8 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      <span className="text-xs font-medium tracking-wide">Loading workspace...</span>
    </div>
  );
}

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

  const isPrivileged = session.role === 'doctor' || session.role === 'hospital_admin' || session.role === 'super_admin';
  const selfPatientId = String(session.patientId || '').trim();
  const requestedId = String(patientId || '').trim();

  // Patients cannot view another patient's data
  if (!isPrivileged && selfPatientId && requestedId && selfPatientId.toLowerCase() !== requestedId.toLowerCase()) {
    toast.error(
      'Access Denied: As a patient, you are strictly restricted to your own personal telemetry records.',
      { duration: 4000 }
    );
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <EmergencyProvider>
      <MainLayout>
        <PatientDetails />
      </MainLayout>
    </EmergencyProvider>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <PwaProvider>
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

        {/* PWA Cross-Platform Modals & Floating Install Banner */}
        <IosInstallModal />
        <PwaFloatingBanner />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes location={location}>
              <Route path="/" element={<SplashScreen />} />
              
              {/* Public Auth Routes */}
              <Route path="/login" element={<AuthRoute><LoginSelection /></AuthRoute>} />
              <Route path="/login/patient" element={<AuthRoute><PatientLogin /></AuthRoute>} />
              <Route path="/login/doctor" element={<AuthRoute><DoctorLogin /></AuthRoute>} />
              <Route path="/login/admin" element={<AuthRoute><AdminLogin /></AuthRoute>} />
              <Route path="/admin/login" element={<Navigate to="/login/admin" replace />} />
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

              {/* SCOPED: Patient Details Route (Scoped workspace for assigned doctor / patient) */}
              <Route
                path="/patients/:patientId"
                element={<ScopedPatientDetailsRoute />}
              />
              <Route
                path="/doctor/patients/:patientId"
                element={<ScopedPatientDetailsRoute />}
              />

              <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      </VideoCallProvider>
    </PwaProvider>
  );
}
