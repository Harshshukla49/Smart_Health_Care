import React from 'react';
import { motion } from 'framer-motion';

const variantStyles = {
  primary:
    'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-[0_2px_10px_rgba(2,132,199,0.25)] hover:shadow-[0_4px_16px_rgba(2,132,199,0.35)]',
  secondary:
    'border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-slate-50 hover:border-slate-300 shadow-2xs',
  accent:
    'bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-[0_2px_10px_rgba(13,148,136,0.25)]',
  danger:
    'bg-[#E11D48] hover:bg-[#BE123C] text-white shadow-[0_2px_10px_rgba(225,29,72,0.25)]',
  ghost:
    'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 sm:px-5 py-2.5 text-xs sm:text-sm',
  lg: 'px-6 py-3 text-sm sm:text-base font-bold',
};

export function Button({ as: Component = 'button', variant = 'primary', size = 'md', className = '', children, onClick, ...props }) {
  const sharedClasses = [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
    variantStyles[variant] || variantStyles.primary,
    sizeStyles[size],
    className,
  ].filter(Boolean).join(' ');

  const handleRipple = (event) => {
    const host = event.currentTarget;
    if (!host || host.classList.contains('disabled')) {
      return;
    }

    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const hasPointer = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && (event.clientX !== 0 || event.clientY !== 0);
    const centerX = hasPointer ? event.clientX - rect.left : rect.width / 2;
    const centerY = hasPointer ? event.clientY - rect.top : rect.height / 2;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${centerX - size / 2}px`;
    ripple.style.top = `${centerY - size / 2}px`;
    host.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  };

  const handleClick = (event) => {
    handleRipple(event);
    if (typeof onClick === 'function') {
      onClick(event);
    }
  };

  if (Component === 'button') {
    return (
      <motion.button
        className={sharedClasses}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={handleClick}
        {...props}
      >
        <span className="btn-ambient" aria-hidden="true" />
        {children}
      </motion.button>
    );
  }

  return (
    <Component className={sharedClasses} onClick={handleClick} {...props}>
      <span className="btn-ambient" aria-hidden="true" />
      {children}
    </Component>
  );
}
