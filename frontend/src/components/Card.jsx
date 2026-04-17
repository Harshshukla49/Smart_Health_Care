import React from 'react';
import { motion } from 'framer-motion';

export function Card({ className = '', children, gradient = false, ...props }) {
  const baseClasses = [
    'card',
    'card-glass',
    'rounded-[20px]',
    'p-6',
    'overflow-hidden',
    'transition-all',
    'duration-300',
    'border', 
    'border-white/10',
    'hover:border-white/20',
    gradient ? 'bg-gradient-to-br from-white/5 to-white/2' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={baseClasses}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
