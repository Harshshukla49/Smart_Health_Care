import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export function LanguageSwitcher({ compact = false }) {
  const { language, languages, setLanguage, t } = useI18n();

  return (
    <label className={[
      'inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200',
      compact ? 'text-xs' : 'text-sm',
    ].join(' ')}>
      <Languages className="h-4 w-4 text-cyan-200" />
      <span className={compact ? 'hidden sm:inline' : ''}>{t('layout.languageLabel')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="rounded-xl border border-white/15 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none"
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
