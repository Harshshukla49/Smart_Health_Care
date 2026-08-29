import React from 'react';
import { motion } from 'framer-motion';

export function Card({ className = '', children, gradient = false, ...props }) {
  const baseClasses = [
    'card',
    'rounded-[16px]',
    'p-5',
    'sm:p-6',
    'overflow-hidden',
    'transition-all',
    'duration-200',
    'bg-white',
    'border',
    'border-[#E2E8F0]',
    'shadow-[0_4px_18px_rgba(15,23,42,0.04)]',
    'hover:border-slate-300',
    'hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]',
    className,
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={baseClasses}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default Card;
