import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, HeartPulse, LayoutDashboard, LogOut, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { clearAuthSession, getAuthSession, getDashboardPathForRole, normalizeRole } from '../utils/auth';
import { useI18n } from '../context/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function DashboardLayout({ role, title, subtitle, children, backTo = '/', backLabel = '' }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();
  const session = getAuthSession();
  const currentRole = normalizeRole(role || session?.role);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const roleLabel = currentRole === 'doctor' ? t('roles.doctor') : t('roles.patient');
  const userName = session?.name || t('roles.user', { role: roleLabel });
  const resolvedBackLabel = backLabel || t('common.backToHome');
  const overviewPath = getDashboardPathForRole(currentRole);

  const navigation = useMemo(
    () => [
      { label: t('layout.nav.overview'), to: overviewPath, icon: LayoutDashboard, primary: true },
      { label: t('layout.nav.vitals'), to: '#vitals', icon: HeartPulse },
      { label: t('layout.nav.alerts'), to: '#alerts', icon: Bell },
      { label: t('layout.nav.insights'), to: '#insights', icon: Sparkles },
    ],
    [overviewPath, t]
  );

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.26),transparent_32%),linear-gradient(135deg,#020617_0%,#08101f_48%,#0e1325_100%)]" />
      <div className="relative flex min-h-screen w-full flex-col gap-4 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 md:gap-6 md:px-5 md:py-5 lg:flex-row lg:items-start lg:gap-6 lg:px-6 lg:py-6 xl:gap-8 xl:px-8 xl:py-8">
        <aside className="hidden w-full shrink-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/8 p-4 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-2xl sm:p-5 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[19rem] lg:overflow-y-auto lg:rounded-[2rem] lg:p-5">
          <Link to={overviewPath} className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-glow">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-white">{t('common.smartHealth')}</p>
              <p className="font-body text-xs uppercase tracking-[0.35em] text-slate-400">{t('layout.roleConsole', { role: roleLabel })}</p>
            </div>
          </Link>

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{t('layout.signedInAs')}</p>
            <p className="mt-2 font-heading text-2xl font-bold text-white">{userName}</p>
            <p className="mt-1 font-body text-sm text-slate-400">{session?.email || t('common.noEmailStored')}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;

              if (item.primary) {
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white ring-1 ring-cyan-300/25 transition hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              }

              return (
                <a
                  key={item.label}
                  href={item.to}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm leading-7 text-slate-300">
              {t('layout.sidebarDescription')}
            </p>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
            >
              <LogOut className="h-4 w-4" />
              {t('common.logout')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5 lg:gap-6">
          <header className="rounded-[1.5rem] border border-white/10 bg-white/8 px-3 py-4 shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur-2xl sm:px-5 sm:py-5 sm:rounded-[2rem] lg:px-6 lg:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <Link to={backTo} className="dashboard-back-link flex items-center gap-1 sm:gap-2" aria-label={resolvedBackLabel}>
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="dashboard-back-label hidden text-xs sm:inline sm:text-sm">{resolvedBackLabel}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 sm:h-11 sm:w-11 sm:rounded-2xl lg:hidden"
                    aria-label={t('layout.openNavigation')}
                  >
                    <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>

                  <div className="hidden sm:block lg:hidden">
                    <p className="font-display text-base font-bold text-white sm:text-lg">{t('common.smartHealth')}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t('layout.roleConsole', { role: roleLabel })}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300 sm:text-xs">{t('layout.roleDashboard', { role: roleLabel })}</p>
                  <h1 className="mt-1 font-heading text-xl font-bold text-white sm:mt-2 sm:text-2xl md:text-4xl">{title}</h1>
                  <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-300 sm:mt-2 sm:text-sm sm:leading-7">{subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 sm:flex sm:items-center sm:gap-2 md:px-4 md:py-2 md:text-sm">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  <span className="hidden md:inline">{t('layout.secureSession', { role: roleLabel })}</span>
                </div>
                <LanguageSwitcher compact />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/8 p-4 shadow-[0_30px_120px_rgba(2,6,23,0.35)] backdrop-blur-2xl sm:p-5 sm:rounded-[2rem] lg:p-8 xl:p-10">
            {children}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label={t('layout.closeNavigation')}
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm border-r border-white/10 bg-[#08101f]/96 p-4 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-2xl sm:w-[78%] sm:p-5 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              <div className="flex items-center justify-between">
                <Link to={overviewPath} className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-glow">
                    <HeartPulse className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-heading text-lg font-bold text-white">{t('common.smartHealth')}</p>
                    <p className="font-body text-xs uppercase tracking-[0.35em] text-slate-400">{t('layout.roleConsole', { role: roleLabel })}</p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  aria-label={t('layout.closeNavigation')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{t('layout.signedInAs')}</p>
                <p className="mt-2 font-heading text-2xl font-bold text-white">{userName}</p>
                <p className="mt-1 font-body text-sm text-slate-400">{session?.email || t('common.noEmailStored')}</p>
              </div>

              <div className="mt-4">
                <LanguageSwitcher />
              </div>

              <nav className="mt-6 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;

                  if (item.primary) {
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold text-white ring-1 ring-cyan-300/25 transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    );
                  }

                  return (
                    <a
                      key={item.label}
                      href={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </button>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
