import React from 'react';
import { motion } from 'framer-motion';

const variantStyles = {
  primary:
    'bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 text-slate-950 shadow-glow hover:brightness-110',
  secondary:
    'border border-white/15 bg-white/8 text-slate-100 hover:border-cyan-300/50 hover:bg-white/12',
  ghost:
    'text-slate-200 hover:bg-white/8 hover:text-white',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-4 text-base',
};

export function Button({ as: Component = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  const sharedClasses = [
    'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]',
    variantStyles[variant],
    sizeStyles[size],
    className,
  ].join(' ');

  if (Component === 'button') {
    return (
      <motion.button
        className={sharedClasses}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <Component className={sharedClasses} {...props}>
      {children}
    </Component>
  );
}
