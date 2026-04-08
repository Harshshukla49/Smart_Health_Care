import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';
import { HeartPulse, X } from 'lucide-react';
import { navigationLinks } from '../data/demoData';

const panelVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
  exit: { x: '-100%' },
};

export function Sidebar({ open, onClose }) {
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
            aria-label="Close sidebar"
            className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed inset-y-0 left-0 z-[70] w-[84%] max-w-sm border-r border-white/10 bg-slate-950/95 px-5 py-5 shadow-glass backdrop-blur-2xl lg:hidden"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3" onClick={onClose}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-slate-950 shadow-glow">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <span className="font-display text-lg font-bold text-white">Smart Health</span>
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-2">
              {navigationLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    [
                      'rounded-2xl px-4 py-3 text-base font-semibold transition',
                      isActive ? 'bg-white/12 text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white',
                    ].join(' ')
                  }
                  onClick={onClose}
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink
                to="/login"
                className="mt-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 px-4 py-3 text-base font-bold text-slate-950 shadow-glow"
                onClick={onClose}
              >
                Login
              </NavLink>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
              Monitor vitals, review trends, and respond to critical events from a single mobile-first workspace.
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}