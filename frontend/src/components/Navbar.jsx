import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, HeartPulse } from 'lucide-react';
import { navigationLinks } from '../data/demoData';
import { Sidebar } from './Sidebar';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../context/I18nContext';

const linkClasses = ({ isActive }) =>
  [
    'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300',
    isActive ? 'bg-white/12 text-white ring-1 ring-cyan-300/25' : 'text-slate-300 hover:bg-white/8 hover:text-white',
  ].join(' ');

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const labelByPath = {
    '/': t('public.nav.home'),
    '/about': t('public.nav.about'),
    '/blog': t('public.nav.blog'),
    '/contact': t('public.nav.contact'),
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-950/55 backdrop-blur-2xl">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
            aria-label={t('public.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-glow">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="hidden flex-col sm:flex">
              <span className="font-heading text-lg font-bold leading-none text-white">{t('common.smartHealth')}</span>
              <span className="font-body text-xs uppercase tracking-[0.3em] text-slate-400">{t('public.brandSub')}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {navigationLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClasses}>
                {labelByPath[link.path] || link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex">
            <LanguageSwitcher compact />
          </div>

          <Link
            to="/login"
            className="hidden rounded-full border border-cyan-300/25 bg-gradient-to-r from-cyan-400/18 via-sky-400/18 to-fuchsia-400/18 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(125,211,252,0.15),0_18px_50px_rgba(14,165,233,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/10 lg:inline-flex"
          >
            {t('public.login')}
          </Link>
        </div>
      </header>

      <Sidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
