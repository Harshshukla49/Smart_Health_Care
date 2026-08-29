import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export function LanguageSwitcher({ compact = false, theme = 'light' }) {
  const { language, languages, setLanguage, t } = useI18n();

  const isLight = theme === 'light';

  return (
    <label
      className={[
        'inline-flex items-center gap-2 rounded-xl transition',
        isLight
          ? 'border border-slate-200 bg-white/90 px-2.5 py-1 text-slate-700 shadow-2xs'
          : 'border border-white/10 bg-white/5 px-3 py-2 text-slate-200',
        compact ? 'text-xs' : 'text-sm',
      ].join(' ')}
    >
      <Languages className={`h-3.5 w-3.5 ${isLight ? 'text-[#1677FF]' : 'text-cyan-200'}`} />
      <span className={compact ? 'hidden sm:inline' : ''}>{t('layout.languageLabel')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className={[
          'rounded-lg text-xs outline-none transition cursor-pointer',
          isLight
            ? 'border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 focus:border-[#1677FF]'
            : 'border border-white/15 bg-slate-950/70 px-2 py-1 text-slate-100',
        ].join(' ')}
        aria-label={t('layout.languageLabel')}
      >
        {Object.entries(languages).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
