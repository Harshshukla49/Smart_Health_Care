import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">404</p>
        <h1 className="font-display text-4xl font-bold text-white md:text-5xl">That page does not exist.</h1>
        <p className="text-sm leading-7 text-slate-300">Use the navigation to return to the home page or continue to login.</p>
        <div className="flex justify-center gap-3">
          <Button as={Link} to="/">Go Home</Button>
          <Button as={Link} to="/login" variant="secondary">Login</Button>
        </div>
      </div>
    </div>
  );
}
