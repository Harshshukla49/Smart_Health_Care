import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardSidebar } from './dashboard/Sidebar';
import { LanguageSwitcher } from './LanguageSwitcher';
import { clearAuthSession, getAuthSession, normalizeRole } from '../utils/auth';
import { useI18n } from '../context/I18nContext';
import { useVideoCall } from '../context/VideoCallContext';

export function DashboardLayout({
  role,
  title,
  subtitle,
  children,
  backTo = '/',
  backLabel = 'Back to home',
  activeSection,
  onSectionSelect,
}) {
  const { t } = useI18n();
  const { openDialer } = useVideoCall();
  const navigate = useNavigate();
  const session = getAuthSession();
  const currentRole = normalizeRole(role || session?.role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    toast.dismiss();
    navigate('/login', { replace: true });
  };

  const isDoctor = currentRole === 'doctor';
  const workspaceLabel = isDoctor ? 'Clinical Workspace' : 'Personal Health Workspace';
  const doctorName = session?.name || (isDoctor ? 'Physician' : 'Patient');
  const doctorTitle = isDoctor ? (session?.specialty || 'Attending Physician') : 'Patient';
  const initials = (doctorName || (isDoctor ? 'MD' : 'PT')).slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F9FC] text-[#0F172A] font-sans antialiased p-3 sm:p-5 lg:p-6">
      <div className="mx-auto flex w-full max-w-[1720px] gap-4 lg:gap-6">
        <DashboardSidebar
          role={currentRole}
          session={session}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onLogout={handleLogout}
          activeSection={activeSection}
          onSectionSelect={onSectionSelect}
        />

        <div className="min-w-0 flex-1 space-y-4 sm:space-y-5 lg:space-y-6">
          {/* Top Clinical Floating Header Bar */}
          <header className="rounded-[18px] border border-[#E2E8F0] bg-white px-4 py-3 sm:px-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left Actions */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open dashboard navigation"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  aria-label="Toggle dashboard sidebar"
                  className="hidden h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 lg:grid"
                >
                  <PanelLeftClose className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                </button>

                <Link
                  to={backTo}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                >
                  <Home className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden xs:inline">{backLabel}</span>
                </Link>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0284C7]">
                  <Sparkles className="h-3.5 w-3.5 text-[#0284C7]" />
                  <span>{workspaceLabel}</span>
                </span>
              </div>

              {/* Right Clinical Controls */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 ml-auto">
                {/* Secure Session Active Badge */}
                <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>{t('layout.secureSessionActive')}</span>
                </div>

                {/* Dashboard Language Switcher */}
                <div className="inline-flex items-center">
                  <LanguageSwitcher compact theme="light" />
                </div>

                {/* Notifications Button */}
                <a
                  href="#alerts"
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                  title={t('layout.nav.alerts')}
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                </a>

                {/* Realtime Chat Button */}
                <Link
                  to="/chat"
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                  title="Doctor & Patient Chat"
                >
                  <MessageSquare className="h-4 w-4" />
                </Link>

                {/* Quick Telehealth Video Call Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isDoctor) {
                      toast('To start a video call, click "Video Call" on any patient row or workspace.', { icon: '🩺' });
                    } else {
                      openDialer();
                    }
                  }}
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-teal-200 bg-teal-50 text-[#0D9488] transition hover:bg-teal-100 shadow-2xs"
                  title={isDoctor ? 'Initiate consultation from patient roster' : 'Start Telehealth Video Consultation'}
                >
                  <Video className="h-4 w-4" />
                </button>

                <div className="hidden md:block h-6 w-px bg-slate-200" />

                {/* User / Doctor Profile Preview */}
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 pl-1.5 pr-3 py-1 shadow-2xs">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#0284C7] to-blue-700 text-white text-xs font-bold shadow-xs border border-white ring-1 ring-sky-200">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <p className="text-xs font-bold text-[#0F172A] leading-tight">{doctorName}</p>
                    <p className="text-[10px] font-medium text-[#64748B] mt-0.5 leading-tight">{doctorTitle}</p>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shadow-2xs"
                  title={t('common.logout')}
                  aria-label={t('common.logout')}
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden xs:inline">{t('common.logout')}</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
