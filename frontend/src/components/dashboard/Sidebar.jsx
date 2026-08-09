import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BellRing,
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Pill,
  PlusCircle,
  Settings,
  ShieldAlert,
  UsersRound,
  Waves,
  X,
} from 'lucide-react';

const doctorNavigation = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Live monitoring', to: '/dashboard#vitals', icon: Activity },
  { label: 'Patients', to: '/dashboard#patients', icon: UsersRound },
  { label: 'Add patient', to: '/add-patient', icon: PlusCircle },
  { label: 'Risk predictions', to: '/dashboard#insights', icon: ShieldAlert },
  { label: 'ECG analysis', to: '/dashboard#ecg', icon: Waves },
  { label: 'Reports', to: '/dashboard#reports', icon: FileText },
  { label: 'Notifications', to: '/dashboard#alerts', icon: BellRing },
  { label: 'Settings', to: '/dashboard#profile', icon: Settings },
];

const patientNavigation = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'My vitals', to: '/dashboard#vitals', icon: HeartPulse },
  { label: 'Live ECG', to: '/dashboard#ecg', icon: Waves },
  { label: 'Medicines', to: '/dashboard#medicines', icon: Pill },
  { label: 'Appointments', to: '/dashboard#appointments', icon: CalendarDays },
  { label: 'Reports', to: '/dashboard#reports', icon: FileText },
  { label: 'Emergency', to: '/dashboard#alerts', icon: ShieldAlert },
  { label: 'Settings', to: '/dashboard#profile', icon: Settings },
];

function SidebarLinks({ role, onNavigate, mobile = false }) {
  const items = role === 'doctor' ? doctorNavigation : patientNavigation;
  const location = useLocation();

  return (
    <nav aria-label={`${role === 'doctor' ? 'Doctor' : 'Patient'} dashboard navigation`} className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            className={(() => {
              const [path, hash = ''] = item.to.split('#');
              const isActive = path === location.pathname && (hash ? `#${hash}` === location.hash : !location.hash);
              return [
              'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80',
              isActive ? 'text-white' : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100',
              ].join(' ');
            })()}
          >
            {(() => {
              const [path, hash = ''] = item.to.split('#');
              const isActive = path === location.pathname && (hash ? `#${hash}` === location.hash : !location.hash);
              return (
              <>
                {isActive ? <motion.span layoutId={mobile ? 'mobile-dashboard-nav' : 'dashboard-nav'} className="absolute inset-0 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/20 via-sky-500/12 to-violet-500/15" transition={{ type: 'spring', stiffness: 360, damping: 30 }} /> : null}
                <Icon className={`relative h-4 w-4 shrink-0 ${isActive ? 'text-cyan-200' : 'text-slate-500 transition group-hover:text-cyan-200'}`} />
                <span className="relative flex-1">{item.label}</span>
                {mobile ? <ChevronRight className="relative h-4 w-4 text-slate-500" /> : null}
              </>
              );
            })()}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarIdentity({ role }) {
  const isDoctor = role === 'doctor';
  return (
    <Link to="/dashboard" className="flex items-center gap-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-500 text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.25)]">
        <HeartPulse className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-bold tracking-tight text-white">Care workspace</span>
        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{isDoctor ? 'Clinical command' : 'Personal health'}</span>
      </span>
    </Link>
  );
}

export function DashboardSidebar({ role = 'patient', mobileOpen, onClose }) {
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 flex-col rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.32)] backdrop-blur-2xl lg:flex">
        <SidebarIdentity role={role} />
        <div className="my-5 h-px bg-gradient-to-r from-cyan-300/35 via-white/10 to-transparent" />
        <SidebarLinks role={role} />
        <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-slate-950/30 to-violet-400/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Secure by design</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Your workspace is scoped to the people and health data you are allowed to access.</p>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close dashboard navigation"
              className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[80] flex w-[86%] max-w-sm flex-col border-r border-white/10 bg-[#07111f]/95 p-5 shadow-[0_28px_100px_rgba(2,6,23,0.6)] backdrop-blur-2xl lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <SidebarIdentity role={role} />
                <button type="button" onClick={onClose} aria-label="Close dashboard navigation" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="my-6 h-px bg-gradient-to-r from-cyan-300/35 via-white/10 to-transparent" />
              <SidebarLinks role={role} mobile onNavigate={onClose} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
