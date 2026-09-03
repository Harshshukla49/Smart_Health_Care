import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Menu, HeartPulse, LogOut, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { navigationLinks } from '../data/demoData';
import { Sidebar } from './Sidebar';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../context/I18nContext';
import { clearAuthSession, getAuthSession } from '../utils/auth';

const linkClasses = ({ isActive }) =>
  [
    'rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200',
    isActive ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/80 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ');

export function Navbar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = getAuthSession();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    toast.dismiss();
    navigate('/login', { replace: true });
  };

  const labelByPath = {
    '/': t('public.nav.home'),
    '/about': t('public.nav.about'),
    '/blog': t('public.nav.blog'),
    '/contact': t('public.nav.contact'),
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xs">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 max-w-[1720px] mx-auto">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label={t('public.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="hidden flex-col sm:flex">
              <span className="font-heading text-lg font-bold leading-none text-slate-900">{t('common.smartHealth')}</span>
              <span className="font-body text-[10px] uppercase tracking-[0.25em] text-slate-400 mt-0.5">{t('public.brandSub')}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1.5 lg:flex">
            {navigationLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClasses}>
                {labelByPath[link.path] || link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex">
            <LanguageSwitcher compact />
          </div>

          {session ? (
            <div className="hidden items-center gap-2.5 lg:flex">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 shadow-2xs transition hover:bg-sky-100"
              >
                <LayoutDashboard className="h-4 w-4 text-sky-600" />
                <span>Dashboard</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <LogOut className="h-4 w-4 text-rose-600" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-700 lg:inline-flex"
            >
              {t('public.login')}
            </Link>
          )}
        </div>
      </header>

      <Sidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
