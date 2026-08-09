import React from 'react';
import { HeartPulse, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/10 bg-slate-950/55 text-slate-300 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -right-20 top-0 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto grid w-full max-w-[1600px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_0.7fr_0.9fr] lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,0.22)]">
              <HeartPulse className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-extrabold leading-none text-white">Smart Health</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/75">Care Intelligence</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
            Confident, connected care with real-time health signals and smarter clinical decisions.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">Explore</p>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer navigation">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold text-slate-300 outline-none transition hover:text-cyan-200 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/8 px-3 py-1.5 text-xs font-bold text-emerald-100">
            <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Secure health monitoring
          </div>
          <a
            href="mailto:support@smarthealth.example"
            className="flex w-fit items-center gap-2 text-sm font-semibold text-slate-300 outline-none transition hover:text-cyan-200 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Mail className="h-4 w-4 text-cyan-200" aria-hidden="true" />
            support@smarthealth.example
          </a>
        </div>
      </div>
      <div className="relative border-t border-white/8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} Smart Health. All rights reserved.</p>
          <p>Built for calm, secure, connected care.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
