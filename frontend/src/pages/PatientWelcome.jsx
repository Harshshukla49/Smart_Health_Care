import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../utils/auth';
import { Button } from '../components/Button';

export default function PatientWelcome() {
  const navigate = useNavigate();
  useEffect(() => {
    const session = getAuthSession();
    if (!session || session.role !== 'patient') {
      navigate('/login/patient', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050816] text-white">
      <div className="bg-white/10 rounded-2xl p-8 shadow-xl flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to Smart Health Care!</h1>
        <p className="mb-6 text-lg text-slate-200">Your health dashboard is ready. You can now track your vitals, medicines, and connect with your doctor.</p>
        <Button size="lg" onClick={() => navigate('/dashboard/patient', { replace: true })}>
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
