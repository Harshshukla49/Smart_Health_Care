import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Footer } from './Footer';
import { Header } from './Header';

export function AppLayout({ children, className = '' }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050816] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.19),transparent_32%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(20,184,166,0.08),transparent_34%),linear-gradient(135deg,#050816_0%,#08101f_52%,#0a0b1a_100%)]"
        aria-hidden="true"
      />
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={`${location.pathname}${location.search}${location.hash}`}
            className={['flex min-h-0 flex-1 flex-col', className].filter(Boolean).join(' ')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
        <Footer />
      </div>
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(8, 16, 31, 0.92)',
            color: '#e2e8f0',
            border: '1px solid rgba(125, 211, 252, 0.22)',
            borderRadius: '18px',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 18px 48px rgba(2, 6, 23, 0.38)',
          },
        }}
      />
    </div>
  );
}

export default AppLayout;
