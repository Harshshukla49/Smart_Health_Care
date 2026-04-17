import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
