import React from 'react';
import { motion } from 'framer-motion';

const variantStyles = {
  primary:
    'btn btn-primary',
  secondary:
    'btn btn-secondary',
  accent:
    'btn btn-accent',
  danger:
    'btn btn-danger',
  ghost:
    'btn btn-ghost',
};

const sizeStyles = {
  sm: 'btn-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'btn-lg',
};

export function Button({ as: Component = 'button', variant = 'primary', size = 'md', className = '', children, onClick, ...props }) {
  const sharedClasses = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
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
