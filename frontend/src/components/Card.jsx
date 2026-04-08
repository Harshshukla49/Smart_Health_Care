import React from 'react';
import { motion } from 'framer-motion';

export function Card({ className = '', children, ...props }) {
  return (
    <motion.div
      className={[
        'rounded-3xl border border-white/12 bg-white/8 p-6 shadow-glass backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/35 hover:bg-white/10',
        className,
      ].join(' ')}
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
