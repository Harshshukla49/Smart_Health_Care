import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  BellRing,
  BrainCircuit,
  ChevronRight,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Pill,
  PlusCircle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  Waves,
  X,
} from 'lucide-react';
import { clearAuthSession, getAuthSession } from '../../utils/auth';
import { useI18n } from '../../context/I18nContext';
import { LanguageSwitcher } from '../LanguageSwitcher';

function getNavigationSections(role, t) {
  const isDoctor = role === 'doctor';
  const tr = (key, fallback) => (t ? t(key) : fallback);

  if (!isDoctor) {
    // PATIENT SCOPED NAVIGATION:
    return [
      {
        title: tr('layout.nav.myHealth', 'MY HEALTH'),
        items: [
          { id: 'overview', label: tr('layout.nav.healthOverview', 'Health Overview'), to: '/dashboard', icon: LayoutDashboard },
          { id: 'vitals', label: tr('layout.nav.myLiveVitals', 'My Live Vitals'), to: '/dashboard#vitals', icon: Activity },
          { id: 'medications', label: tr('layout.nav.myMedications', 'My Medications'), to: '/dashboard#medications', icon: Pill },
          { id: 'ai-assessment', label: tr('layout.nav.aiAssessment', 'AI Health Assessment'), to: '/dashboard#ai-assessment', icon: BrainCircuit },
          { id: 'patients', label: tr('layout.nav.myCareTeam', 'My Care Team'), to: '/dashboard#patients', icon: UsersRound },
        ],
      },
      {
        title: tr('layout.nav.recordsAlerts', 'RECORDS & ALERTS'),
        items: [
          { id: 'ecg', label: tr('layout.nav.myEcgRhythm', 'My ECG Rhythm'), to: '/dashboard#ecg', icon: Waves },
          { id: 'reports', label: tr('layout.nav.healthReports', 'Health Reports'), to: '/dashboard#reports', icon: FileText },
          { id: 'alerts', label: tr('layout.nav.emergencySos', 'Emergency & SOS'), to: '/dashboard#alerts', icon: BellRing },
        ],
      },
      {
        title: tr('layout.nav.account', 'ACCOUNT'),
        items: [
          { id: 'settings', label: tr('layout.nav.accountSos', 'Account & SOS'), to: '/settings', icon: Settings },
        ],
      },
    ];
  }

  // DOCTOR SCOPED NAVIGATION:
  return [
    {
      title: tr('layout.nav.clinicalCommand', 'CLINICAL COMMAND'),
      items: [
        { id: 'overview', label: tr('layout.nav.wardOverview', 'Ward Overview'), to: '/dashboard', icon: LayoutDashboard },
        { id: 'vitals', label: tr('layout.nav.liveMonitoring', 'Live Monitoring'), to: '/dashboard#vitals', icon: Activity },
        { id: 'patients', label: tr('layout.nav.patientsRoster', 'Patients Roster'), to: '/dashboard#patients', icon: UsersRound },
        { id: 'medications', label: tr('layout.nav.prescriptionsMeds', 'Prescriptions & Meds'), to: '/dashboard#medications', icon: Pill },
        { id: 'add-patient', label: tr('layout.nav.addPatient', 'Add Patient'), to: '/add-patient', icon: PlusCircle },
      ],
    },
    {
      title: tr('layout.nav.diagnosticsTriage', 'DIAGNOSTICS & TRIAGE'),
      items: [
        { id: 'ai-assessment', label: tr('layout.nav.aiAssessmentTriage', 'AI Assessment & First Aid'), to: '/dashboard#ai-assessment', icon: BrainCircuit },
        { id: 'insights', label: tr('layout.nav.riskPredictions', 'Risk Predictions'), to: '/dashboard#insights', icon: ShieldAlert },
        { id: 'ecg', label: tr('layout.nav.ecgAnalysis', 'ECG Analysis'), to: '/dashboard#ecg', icon: Waves },
        { id: 'reports', label: tr('layout.nav.clinicalReports', 'Clinical Reports'), to: '/dashboard#reports', icon: FileText },
        { id: 'alerts', label: tr('layout.nav.emergencyAlerts', 'Emergency Alerts'), to: '/dashboard#alerts', icon: BellRing },
      ],
    },
    {
      title: tr('layout.nav.system', 'SYSTEM'),
      items: [
        { id: 'settings', label: tr('layout.nav.clinicalSettings', 'Clinical Settings'), to: '/settings', icon: Settings },
      ],
    },
  ];
}

function SidebarLinks({
  activeSection,
  onSectionSelect,
  onNavigate,
  onLogout,
  collapsed = false,
  mobile = false,
  role = 'patient',
}) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationSections = getNavigationSections(role, t);

  const isItemActive = (item) => {
    if (item.id === 'settings' || item.to === '/settings') {
      return location.pathname === '/settings';
    }

    if (item.id === 'add-patient' || item.to === '/add-patient') {
      return location.pathname === '/add-patient';
    }

    if (location.pathname === '/dashboard') {
      if (activeSection) {
        if (item.id === 'overview' && activeSection === 'overview') return true;
        if (item.id === activeSection) return true;
        return false;
      }

      const currentHash = location.hash ? location.hash.replace('#', '') : '';
      if (!currentHash && item.id === 'overview') {
        return true;
      }
      return item.id === currentHash;
    }

    return false;
  };

  const handleItemClick = (e, item) => {
    e.preventDefault();
    if (mobile && onNavigate) {
      onNavigate();
    }

    if (item.to === '/add-patient' && role !== 'doctor') {
      toast.error('Access Denied: Only authorized doctors can register new patients.');
      return;
    }

    if (item.to === '/settings') {
      navigate('/settings');
      return;
    }

    if (item.to === '/add-patient') {
      navigate('/add-patient');
      return;
    }

    if (item.to === '/dashboard') {
      if (location.pathname === '/dashboard') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.history.pushState(null, '', '/dashboard');
        onSectionSelect?.('overview');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    const [path, hash = ''] = item.to.split('#');
    if (hash) {
      if (location.pathname === '/dashboard') {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          window.history.pushState(null, '', `/dashboard#${hash}`);
          onSectionSelect?.(hash);
        }
      } else {
        navigate(item.to);
      }
    }
  };

  return (
    <nav aria-label="Dashboard navigation" className="space-y-4">
      {navigationSections.map((section) => (
        <div key={section.title} className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item);

              return (
                <a
                  key={item.label}
                  href={item.to}
                  onClick={(e) => handleItemClick(e, item)}
                  title={item.label}
                  className={`group flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isActive
                      ? 'bg-[#EFF8FF] text-[#0284C7] font-bold border border-[#BAE6FD] shadow-xs'
                      : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A] border border-transparent'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#0284C7]' : 'text-slate-400 group-hover:text-[#0F172A]'
                    }`}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {mobile && !collapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarIdentity({ collapsed = false }) {
  const session = getAuthSession();
  const isDoctor = session?.role === 'doctor';

  return (
    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284C7] to-blue-700 text-white shadow-md shadow-sky-500/20">
        <HeartPulse className="h-5 w-5 fill-white/20 stroke-white stroke-[2.2]" />
      </div>

      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-sm font-extrabold text-[#0F172A] tracking-tight">
            Smart Healthcare
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isDoctor ? 'bg-emerald-500' : 'bg-sky-500'} animate-pulse`} />
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              {isDoctor ? 'Clinical Command' : 'Patient Portal'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onClose,
  activeSection,
  onSectionSelect,
  collapsed = false,
  role = 'patient',
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const activeSession = getAuthSession();
  const isDoctor = (activeSession?.role || role) === 'doctor';

  const handleLogout = () => {
    clearAuthSession();
    toast.success('Logged out successfully.');
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onClose]);

  const userName =
    activeSession?.name || (isDoctor ? 'Physician' : 'Patient');
  const userRoleTitle = isDoctor ? (activeSession?.specialty || 'Attending Physician') : 'Patient';
  const userEmail =
    activeSession?.email || (isDoctor ? 'doctor@hospital.org' : 'patient@hospital.org');
  const userInitials = (userName || (isDoctor ? 'MD' : 'PT')).slice(0, 2).toUpperCase();

  return (
    <>
      {/* Desktop Clean White Sidebar */}
      <aside
        className={`sticky top-20 hidden h-[calc(100vh-6rem)] shrink-0 flex-col rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200 lg:flex ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarIdentity collapsed={collapsed} />

        <div className="my-4 h-px bg-slate-100" />

        <div className="flex-1 overflow-y-auto pr-1">
          <SidebarLinks
            activeSection={activeSection}
            onSectionSelect={onSectionSelect}
            collapsed={collapsed}
            role={activeSession?.role || role}
          />
        </div>

        {/* Sidebar Footer Controls & User Card */}
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2.5">
          {/* Compact Language Selector for Desktop */}
          {!collapsed && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-slate-500">{t('layout.languageLabel')}</span>
              <LanguageSwitcher compact theme="light" />
            </div>
          )}

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-2xs ${
                  isDoctor
                    ? 'bg-gradient-to-br from-[#0284C7] to-blue-700'
                    : 'bg-gradient-to-br from-teal-600 to-emerald-700'
                }`}
              >
                {userInitials}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#0F172A] leading-tight">
                    {userName}
                  </p>
                  <p className="truncate text-[10px] font-medium text-[#64748B] mt-0.5">
                    <span className={`font-semibold ${isDoctor ? 'text-[#0284C7]' : 'text-teal-700'}`}>
                      {userRoleTitle}
                    </span>{' '}
                    · {userEmail}
                  </p>
                </div>
              )}
            </div>

            {!collapsed ? (
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300 shadow-2xs"
                title={t('common.logout')}
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                <span>{t('common.logout')}</span>
              </button>
            ) : null}
          </div>

          {/* Secure & Role Compliant Badge Card */}
          {!collapsed && (
            <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 flex items-start gap-2 shadow-2xs">
              <ShieldCheck className={`h-4 w-4 shrink-0 mt-0.5 ${isDoctor ? 'text-[#0284C7]' : 'text-teal-600'}`} />
              <div>
                <p className="text-[11px] font-bold text-[#0F172A] leading-tight">
                  {isDoctor ? t('layout.clinicalRoleScoped') : t('layout.personalDataScoped')}
                </p>
                <p className="mt-0.5 text-[10px] text-[#64748B] leading-tight">
                  {isDoctor
                    ? t('layout.clinicalRoleDesc')
                    : t('layout.personalDataDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer (Clean White Clinical Style) */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close dashboard navigation"
              className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-xs lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[80] flex w-[86%] max-w-sm flex-col border-r border-slate-200 bg-white p-5 shadow-2xl lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <SidebarIdentity />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dashboard navigation"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="my-4 h-px bg-slate-100" />

              <div className="flex-1 overflow-y-auto pr-1">
                <SidebarLinks
                  activeSection={activeSection}
                  onSectionSelect={onSectionSelect}
                  onNavigate={onClose}
                  onLogout={handleLogout}
                  mobile
                  role={activeSession?.role || role}
                />
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-600">{t('layout.languageLabel')}</span>
                  <LanguageSwitcher compact theme="light" />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 py-2 text-xs font-bold text-rose-700 shadow-2xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export { Sidebar as DashboardSidebar };
export default Sidebar;
