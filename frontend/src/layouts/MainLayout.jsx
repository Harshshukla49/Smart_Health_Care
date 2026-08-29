import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Navbar } from '../components/Navbar';
import { useI18n } from '../context/I18nContext';

export function MainLayout({ children }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen w-full text-slate-900 bg-[#F8FAFC]">
      <Navbar />
      <main className="w-full px-4 pb-16 pt-28 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200/80 bg-white">
        <div className="flex w-full flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="font-heading text-base font-semibold text-slate-800">{t('public.footerTitle')}</p>
          <p className="font-body">{t('public.footerSubtitle')}</p>
        </div>
      </footer>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            backdropFilter: 'blur(18px)',
          },
        }}
      />
    </div>
  );
}
