import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { navigationLinks } from '../data/demoData';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../context/I18nContext';
import { clearAuthSession, getAuthSession } from '../utils/auth';

const panelVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
  exit: { x: '-100%' },
};

export function Sidebar({ open, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = getAuthSession();

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


  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={t('public.closeSidebar')}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed inset-y-0 left-0 z-[70] w-[84%] max-w-sm border-r border-slate-200 bg-white px-5 py-5 shadow-2xl lg:hidden"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            aria-label={t('public.mobileNavigation')}
          >
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3" onClick={onClose}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <span className="font-heading text-lg font-bold text-slate-900">{t('common.smartHealth')}</span>
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                aria-label={t('public.closeMenu')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <LanguageSwitcher />
            </div>

            <div className="mt-6 flex flex-col gap-1.5">
              {navigationLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    [
                      'rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                      isActive ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/80 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    ].join(' ')
                  }
                  onClick={onClose}
                >
                  {labelByPath[link.path] || link.label}
                </NavLink>
              ))}
              {session ? (
                <>
                  <NavLink
                    to="/dashboard"
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700 transition"
                    onClick={onClose}
                  >
                    <HeartPulse className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      handleLogout();
                    }}
                    className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    <LogOut className="h-4 w-4 text-rose-600" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className="mt-3 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700 transition text-center"
                  onClick={onClose}
                >
                  {t('public.login')}
                </NavLink>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-500">
              {t('public.sidebarBlurb')}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}