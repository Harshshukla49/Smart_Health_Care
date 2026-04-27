import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthSession } from '../utils/auth';

const gradientAnimation = {
  background: 'linear-gradient(120deg, #2563eb, #a855f7, #14b8a6)',
  backgroundSize: '200% 200%',
  animation: 'gradientMove 8s ease-in-out infinite',
};

const glassStyle = {
  background: 'rgba(255,255,255,0.10)',
  boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
  backdropFilter: 'blur(18px)',
  borderRadius: '2rem',
  border: '1px solid rgba(255,255,255,0.18)',
};

export default function SplashScreen() {
  const navigate = useNavigate();
  const session = getAuthSession();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (session?.token) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }, 3500);
    return () => clearTimeout(timeout);
  }, [navigate, session]);

  return (
    <div style={{ ...gradientAnimation, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>
        {`
          @keyframes gradientMove {
            0% {background-position: 0% 50%;}
            50% {background-position: 100% 50%;}
            100% {background-position: 0% 50%;}
          }
        `}
      </style>
      <AnimatePresence>
        <motion.div
          style={{ ...glassStyle, padding: '3rem 2.5rem', minWidth: 340, maxWidth: 400, width: '90%', textAlign: 'center' }}
          initial={{ opacity: 0, scale: 0.92, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -40 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <motion.h1
            style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: 18, letterSpacing: '-1px', color: '#fff', textShadow: '0 2px 16px #0002' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            Smart Health Care
          </motion.h1>
          <motion.div
            style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 10, color: '#e0e7ef' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Welcome to a smarter way of healthcare <span role="img" aria-label="wave">👋</span>
          </motion.div>
          <motion.div
            style={{ fontSize: '1rem', color: '#e0e7ef', marginBottom: 28, fontWeight: 400, opacity: 0.85 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            Monitoring. Caring. Connecting.
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
