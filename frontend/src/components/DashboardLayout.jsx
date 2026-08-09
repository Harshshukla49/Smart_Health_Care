import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, PanelLeftClose, Sparkles } from 'lucide-react';
import { DashboardSidebar } from './dashboard/Sidebar';
import { getAuthSession, normalizeRole } from '../utils/auth';

export function DashboardLayout({ role, title, subtitle, children, backTo = '/', backLabel = 'Back to home' }) {
  const session = getAuthSession();
  const currentRole = normalizeRole(role || session?.role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const workspaceLabel = useMemo(
    () => (currentRole === 'doctor' ? 'Clinical workspace' : 'Personal health workspace'),
    [currentRole]
  );

  return (
    <div className="mx-auto flex w-full max-w-[1680px] gap-5 lg:gap-6">
      <DashboardSidebar
        role={currentRole}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <div className="min-w-0 flex-1 space-y-5 lg:space-y-6">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/45 px-5 py-6 shadow-[0_20px_60px_rgba(2,6,23,0.22)] backdrop-blur-2xl sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(34,211,238,0.13),transparent_28%),radial-gradient(circle_at_92%_5%,rgba(139,92,246,0.16),transparent_30%)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open dashboard navigation"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  aria-label="Toggle dashboard sidebar"
                  className="hidden h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 lg:grid"
                >
                  <PanelLeftClose className={`h-5 w-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                </button>
                <Link to={backTo} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel}
                </Link>
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {workspaceLabel}
                </span>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
              {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{subtitle}</p> : null}
            </div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
              Secure session active
            </div>
          </div>
        </section>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
