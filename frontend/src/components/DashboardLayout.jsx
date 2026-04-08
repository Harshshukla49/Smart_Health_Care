import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, HeartPulse, LayoutDashboard, LogOut, Menu, ShieldCheck, Sparkles, X, Bell } from 'lucide-react';
import { clearAuthSession, getAuthSession, getDashboardPathForRole, normalizeRole } from '../utils/auth';

export function DashboardLayout({ role, title, subtitle, children }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = getAuthSession();
  const currentRole = normalizeRole(role || session?.role);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const userName = session?.name || `${currentRole === 'doctor' ? 'Doctor' : 'Patient'} user`;
  const roleLabel = currentRole === 'doctor' ? 'Doctor' : 'Patient';
  const overviewPath = getDashboardPathForRole(currentRole);

  const navigation = useMemo(
    () => [
      { label: 'Overview', to: overviewPath, icon: LayoutDashboard, primary: true },
      { label: 'Vitals', to: '#vitals', icon: HeartPulse },
      { label: 'Alerts', to: '#alerts', icon: Bell },
      { label: 'Insights', to: '#insights', icon: Sparkles },
    ],
    [overviewPath]
  );

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen w-screen overflow-x-clip bg-[#050816] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.26),transparent_32%),linear-gradient(135deg,#020617_0%,#08101f_48%,#0e1325_100%)]" />
      <div className="relative flex min-h-screen w-full gap-6 px-4 py-4 sm:px-6 lg:px-8 xl:gap-8">
        <aside className="hidden w-[19rem] shrink-0 flex-col rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-2xl lg:flex">
          <Link to={overviewPath} className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-glow">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-white">Smart Health</p>
              <p className="font-body text-xs uppercase tracking-[0.35em] text-slate-400">{roleLabel} console</p>
            </div>
          </Link>

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Signed in as</p>
            <p className="mt-2 font-heading text-2xl font-bold text-white">{userName}</p>
            <p className="mt-1 font-body text-sm text-slate-400">{session?.email || 'No email stored'}</p>
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
              Role-based monitoring with smooth transitions, glass panels, and clear patient signals.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="rounded-[2rem] border border-white/10 bg-white/8 px-4 py-5 shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur-2xl sm:px-5 lg:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="font-display text-xl font-bold text-white">Smart Health</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{roleLabel} console</p>
                </div>
              </div>

              <div className="hidden lg:block">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">{roleLabel} dashboard</p>
                <h1 className="mt-2 font-heading text-2xl font-bold text-white md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-3xl font-body text-sm leading-7 text-slate-300">{subtitle}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 sm:flex sm:items-center sm:gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  {roleLabel} secure session
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-[0_30px_120px_rgba(2,6,23,0.35)] backdrop-blur-2xl sm:p-6 lg:p-8 xl:p-10">
            {children}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm border-r border-white/10 bg-[#08101f]/96 p-5 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-2xl lg:hidden"
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
                    <p className="font-heading text-lg font-bold text-white">Smart Health</p>
                    <p className="font-body text-xs uppercase tracking-[0.35em] text-slate-400">{roleLabel} console</p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Signed in as</p>
                <p className="mt-2 font-heading text-2xl font-bold text-white">{userName}</p>
                <p className="mt-1 font-body text-sm text-slate-400">{session?.email || 'No email stored'}</p>
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
                Logout
              </button>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
