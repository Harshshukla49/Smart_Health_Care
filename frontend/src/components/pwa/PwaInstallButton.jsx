import React from 'react';
import { Download, Smartphone, Check } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

export function PwaInstallButton({ className = '', variant = 'primary', size = 'md' }) {
  const { isInstallable, isInstalled, isIos, promptInstall } = usePwa();

  if (isInstalled) {
    return null; // Already running as installed standalone app
  }

  if (!isInstallable && !isIos) {
    return null; // Browser doesn't support or prompt not available
  }

  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 font-bold transition-all duration-200 cursor-pointer select-none';

  const sizeStyles =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-xl'
      : size === 'lg'
      ? 'px-4 py-2.5 text-sm rounded-2xl'
      : 'px-3 py-2 text-xs rounded-xl';

  const variantStyles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-sm hover:from-sky-500 hover:to-teal-500 hover:shadow-md'
      : variant === 'outline'
      ? 'border border-sky-300 bg-sky-50/80 text-sky-700 hover:bg-sky-100 hover:border-sky-400'
      : 'bg-slate-100 text-slate-700 hover:bg-slate-200';

  return (
    <button
      type="button"
      onClick={promptInstall}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      title={isIos ? 'Add Smart Health Care to Home Screen' : 'Install Smart Health Care App'}
    >
      <Download className="h-3.5 w-3.5" />
      <span>{isIos ? 'Install on iPhone' : 'Install App'}</span>
    </button>
  );
}
