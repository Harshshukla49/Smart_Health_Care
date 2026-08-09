import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  ChevronDown,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Pill,
  Settings,
  ShieldAlert,
  Stethoscope,
  Sun,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';
import {
  clearAuthSession,
  getAuthSession,
  getDashboardPathForRole,
  normalizeRole,
} from '../../utils/auth';

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
];

const roleLinks = {
  doctor: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Patients', to: '/dashboard#patients', icon: UsersRound },
    { label: 'Reports', to: '/dashboard#reports', icon: FileText },
    { label: 'Alerts', to: '/dashboard#alerts', icon: Bell },
    { label: 'Settings', to: '/dashboard#settings', icon: Settings },
  ],
  patient: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'My Health', to: '/dashboard#vitals', icon: Activity },
    { label: 'Reports', to: '/dashboard#reports', icon: FileText },
    { label: 'Medicines', to: '/dashboard#medicines', icon: Pill },
    { label: 'Emergency', to: '/dashboard#emergency', icon: ShieldAlert },
    { label: 'Settings', to: '/dashboard#settings', icon: Settings },
  ],
};

const themeStorageKey = 'smart-health-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const savedTheme = window.localStorage.getItem(themeStorageKey);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setDocumentTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

function initialFromSession(session) {
  const source = session?.name || session?.email || 'Smart Health';
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'SH';
}

function splitPath(target) {
  const [pathname, hash = ''] = target.split('#');
  return { pathname, hash: hash ? `#${hash}` : '' };
}

function isCurrentLink(location, target) {
  const { pathname, hash } = splitPath(target);

  if (location.pathname !== pathname) {
    return false;
  }

  return hash ? location.hash === hash : !location.hash;
}

function HeaderLink({ item, location, onNavigate, mobile = false }) {
  const active = isCurrentLink(location, item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={[
        'group relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        mobile
          ? active
            ? 'bg-cyan-300/12 text-white ring-1 ring-cyan-200/25'
            : 'text-slate-300 hover:bg-white/8 hover:text-white'
          : active
            ? 'text-white'
            : 'text-slate-300 hover:text-white',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      {Icon ? <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" /> : null}
      <span>{item.label}</span>
      {!mobile && active ? (
        <motion.span
          layoutId="global-header-active-indicator"
          className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}
    </Link>
  );
}

function Brand({ onNavigate }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="group inline-flex min-w-0 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      aria-label="Smart Health home"
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-500 to-violet-500 text-slate-950 shadow-[0_10px_32px_rgba(14,165,233,0.35)] transition duration-300 group-hover:scale-105">
        <HeartPulse className="h-5 w-5" aria-hidden="true" />
        <span className="absolute -inset-1 -z-10 rounded-2xl bg-cyan-300/25 blur-lg" />
      </span>
      <span className="hidden min-w-0 flex-col sm:flex">
        <span className="font-body text-base font-extrabold leading-none tracking-tight text-white">Smart Health</span>
        <span className="mt-1 text-[9px] font-bold uppercase leading-none tracking-[0.22em] text-cyan-200/80">Care Intelligence</span>
      </span>
    </Link>
  );
}

function ThemeToggle({ theme, onToggle, compact = false }) {
  const nextLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        compact ? 'h-10 w-10' : 'h-11 w-11',
      ].join(' ')}
      aria-label={nextLabel}
      aria-pressed={theme === 'light'}
      title={nextLabel}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={{ duration: 0.18 }}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-200" /> : <Moon className="h-4 w-4 text-cyan-200" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function AccountMenu({ session, role, onLogout, onCloseMobileMenu }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const dashboardPath = getDashboardPathForRole(role);
  const name = session?.name || (role === 'doctor' ? 'Doctor' : 'Patient');
  const initials = initialFromSession(session);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const goToDashboard = () => {
    setOpen(false);
    onCloseMobileMenu?.();
    navigate(dashboardPath);
  };

  const logout = () => {
    setOpen(false);
    onCloseMobileMenu?.();
    onLogout();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2 text-slate-100 outline-none transition hover:border-cyan-200/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 text-xs font-black text-slate-950">
          {session?.avatar ? <img src={session.avatar} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <ChevronDown className={['h-4 w-4 text-slate-300 transition-transform', open ? 'rotate-180' : ''].join(' ')} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+0.7rem)] z-[100] w-64 overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 p-2 shadow-[0_24px_70px_rgba(2,6,23,0.6)] backdrop-blur-2xl"
            role="menu"
            aria-label="Account menu"
          >
            <div className="rounded-2xl bg-white/5 px-3 py-3">
              <p className="truncate text-sm font-bold text-white">{name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{session?.email || `${role === 'doctor' ? 'Doctor' : 'Patient'} account`}</p>
            </div>
            <button
              type="button"
              onClick={goToDashboard}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-200 outline-none transition hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300"
              role="menuitem"
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-200" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-rose-200 outline-none transition hover:bg-rose-400/10 hover:text-rose-100 focus-visible:ring-2 focus-visible:ring-rose-300"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getAuthSession());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const role = normalizeRole(session?.role);
  const authenticated = Boolean(session);
  const links = useMemo(() => (authenticated ? roleLinks[role] : publicLinks), [authenticated, role]);
  const dashboardPath = getDashboardPathForRole(role);

  useEffect(() => {
    setDocumentTheme(theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    const syncSession = () => setSession(getAuthSession());
    syncSession();

    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', syncSession);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);
  const handleLogout = () => {
    clearAuthSession();
    setSession(null);
    closeMobileMenu();
    navigate('/login', { replace: true });
  };

  const navClass = theme === 'light'
    ? 'border-slate-200/80 bg-white/80 text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,0.12)]'
    : 'border-white/10 bg-slate-950/70 text-white shadow-[0_18px_55px_rgba(2,6,23,0.32)]';

  return (
    <header className="sticky top-0 z-[80] w-full px-3 pt-3 sm:px-5 lg:px-8" aria-label="Primary navigation">
      <div className={[
        'relative mx-auto flex min-h-[4.5rem] w-full max-w-[1600px] items-center justify-between gap-3 rounded-[1.6rem] border px-3 py-2.5 backdrop-blur-2xl transition-colors duration-300 sm:px-4',
        navClass,
      ].join(' ')}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
        </div>

        <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="global-mobile-navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Brand />
        </div>

        <nav className="relative hidden items-center gap-1 xl:flex" aria-label="Main navigation">
          {links.map((item) => <HeaderLink key={item.label} item={item} location={location} />)}
        </nav>

        <div className="relative flex items-center justify-end gap-2">
          <div className="hidden lg:block">
            <LanguageSwitcher compact />
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))} compact />

          {authenticated ? (
            <>
              <Link
                to={dashboardPath}
                className="hidden items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-3.5 py-2 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgba(14,165,233,0.24)] outline-none transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(14,165,233,0.38)] focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:inline-flex"
              aria-label="Open dashboard"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span className="hidden 2xl:inline">Dashboard</span>
            </Link>
            <AccountMenu session={session} role={role} onLogout={handleLogout} />
          </>
        ) : (
          <Link
            to="/login"
            className="hidden rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-4 py-2 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgba(14,165,233,0.24)] outline-none transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(14,165,233,0.38)] focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:inline-flex"
          >
            Login
          </Link>
        )}
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm"
              aria-label="Close navigation menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobileMenu}
            />
            <motion.aside
              id="global-mobile-navigation"
              className="fixed inset-y-0 left-0 z-[100] flex w-[min(88vw,25rem)] flex-col border-r border-white/10 bg-[#06101f]/95 p-4 text-slate-100 shadow-[28px_0_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl sm:p-5"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between gap-3">
                <Brand onNavigate={closeMobileMenu} />
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {authenticated ? (
                <div className="mt-7 rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 text-sm font-black text-slate-950">
                      {initialFromSession(session)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">{session?.name || (role === 'doctor' ? 'Doctor' : 'Patient')}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{session?.email || 'Secure Smart Health account'}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <nav className="mt-7 flex flex-col gap-1.5" aria-label="Mobile navigation links">
                {links.map((item) => (
                  <HeaderLink key={item.label} item={item} location={location} onNavigate={closeMobileMenu} mobile />
                ))}
              </nav>

              <div className="mt-6 border-t border-white/10 pt-5">
                <LanguageSwitcher />
              </div>

              <div className="mt-auto space-y-3 pt-8">
                {authenticated ? (
                  <>
                    <Link
                      to={dashboardPath}
                      onClick={closeMobileMenu}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-4 py-3 text-sm font-extrabold text-slate-950 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-200"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100 outline-none transition hover:bg-rose-400/16 focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-4 py-3 text-sm font-extrabold text-slate-950 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    <Stethoscope className="h-4 w-4" aria-hidden="true" />
                    Login to Smart Health
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export default Header;
