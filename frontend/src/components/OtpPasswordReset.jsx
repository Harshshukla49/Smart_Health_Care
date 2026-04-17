import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  LoaderCircle,
  Lock,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  resetPasswordWithFirebasePhone,
  verifyFirebasePhoneToken,
} from '../services/api';
import { clearPhoneOtpSession, sendOTP, verifyOTP } from '../services/phoneAuth';

const DEFAULT_RESEND_SECONDS = 30;

const fadeVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export function OtpPasswordReset({ role, defaultPhone = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(defaultPhone);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [firebaseIdToken, setFirebaseIdToken] = useState('');

  const roleLabel = role === 'doctor' ? 'Doctor' : 'Patient';
  const isLoading = Boolean(loadingAction);

  const resetFlow = () => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setLoadingAction('');
    setError('');
    setInfo('');
    setShowToast(false);
    setResendIn(0);
    setMaskedPhone('');
    setFirebaseIdToken('');
    clearPhoneOtpSession();
  };

  useEffect(() => {
    setPhone(defaultPhone || '');
  }, [defaultPhone]);

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendIn((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setShowToast(false), 2400);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  const validatePhone = () => {
    const normalized = String(phone || '').replace(/[^\d]/g, '');
    if (normalized.length < 8) {
      setError('Enter a valid registered phone number.');
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    if (!validatePhone()) {
      return;
    }

    setError('');
    setInfo('');
    setLoadingAction('send');
    setFirebaseIdToken('');

    try {
      const response = await sendOTP({
        phoneNumber: phone.trim(),
        role,
      });

      setStep(2);
      setOtp('');
      setResendIn(DEFAULT_RESEND_SECONDS);
      setMaskedPhone(response?.maskedPhone || '');
      setInfo(`OTP sent to ${response?.maskedPhone || 'your registered phone'}.`);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message
        || requestError?.message
        || 'Unable to send OTP at the moment.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleVerifyOtp = async () => {
    if (!validatePhone()) {
      return;
    }

    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP sent to your phone.');
      return;
    }

    setError('');
    setInfo('');
    setLoadingAction('verify');

    try {
      const verified = await verifyOTP({
        otpCode: otp.trim(),
      });

      const verifyResponse = await verifyFirebasePhoneToken({
        idToken: verified.idToken,
        role,
      });

      setFirebaseIdToken(verified.idToken);
      setStep(3);
      setInfo(`Phone verified for ${verifyResponse?.user?.role || role}. Create your new password now.`);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message
        || requestError?.message
        || 'Invalid OTP. Please try again.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleResetPassword = async () => {
    if (!validatePhone()) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Password mismatch. Confirm password should match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setInfo('');
    setLoadingAction('reset');

    try {
      await resetPasswordWithFirebasePhone({
        idToken: firebaseIdToken,
        role,
        newPassword,
        confirmPassword,
      });

      setStep(4);
      setInfo('Password updated successfully.');
      setShowToast(true);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setFirebaseIdToken('');
      clearPhoneOtpSession();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message
        || requestError?.message
        || 'Failed to update password.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const renderStepTitle = () => {
    if (step === 1) return 'Step 1: Enter registered phone number';
    if (step === 2) return 'Step 2: Verify OTP';
    if (step === 3) return 'Step 3: Set new password';
    return 'Step 4: Completed';
  };

  return (
    <div className="mt-5">
      <div id="recaptcha-container" className="sr-only" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            resetFlow();
            setIsOpen(false);
            return;
          }
          setIsOpen(true);
          setError('');
          setInfo('');
        }}
        className="inline-flex w-full items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
      >
        <span>{isOpen ? 'Hide password reset' : 'Forgot password? Reset with OTP'}</span>
        <span className="text-xs tracking-[0.2em] text-cyan-200">OTP</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_50px_rgba(6,15,36,0.32)] backdrop-blur-xl sm:p-5"
          >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Forgot Password</p>
          <h3 className="mt-1 text-base font-semibold text-white">{roleLabel} account recovery</h3>
          <p className="mt-1 text-xs text-slate-300">{renderStepTitle()}</p>
        </div>
        <div className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-100">
          OTP RESET
        </div>
      </div>

      {info ? (
        <motion.div
          className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {info}
        </motion.div>
      ) : null}

      {error ? (
        <motion.div
          className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      ) : null}

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step-1"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <Field
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91XXXXXXXXXX"
              icon={<Phone className="h-4 w-4" />}
              disabled={isLoading}
            />
            <ActionButton
              onClick={handleSendOtp}
              disabled={isLoading}
              loading={loadingAction === 'send'}
              label="Send OTP"
            />
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="step-2"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <Field
              label="One-Time Password"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="Enter 6-digit OTP"
              icon={<ShieldCheck className="h-4 w-4" />}
              disabled={isLoading}
            />

            <div className="flex flex-wrap gap-3">
              <ActionButton
                onClick={handleVerifyOtp}
                disabled={isLoading}
                loading={loadingAction === 'verify'}
                label="Verify OTP"
              />
              <ActionButton
                onClick={handleSendOtp}
                disabled={isLoading || resendIn > 0}
                loading={loadingAction === 'send'}
                label={resendIn > 0 ? `Resend OTP in ${String(resendIn).padStart(2, '0')}s` : 'Resend OTP'}
                variant="secondary"
              />
            </div>

            {maskedPhone ? <p className="text-xs text-slate-300">Code sent to {maskedPhone}.</p> : null}
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div
            key="step-3"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <Field
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Create strong password"
              icon={<Lock className="h-4 w-4" />}
              disabled={isLoading}
            />
            <Field
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              icon={<ShieldCheck className="h-4 w-4" />}
              disabled={isLoading}
            />

            <p className="text-xs leading-6 text-slate-300">
              Use at least 8 characters with uppercase, lowercase, number, and a special character.
            </p>

            <ActionButton
              onClick={handleResetPassword}
              disabled={isLoading || !firebaseIdToken}
              loading={loadingAction === 'reset'}
              label="Update Password"
            />
          </motion.div>
        ) : null}

        {step === 4 ? (
          <motion.div
            key="step-4"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4 text-emerald-100"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">Password updated successfully</p>
                  <p className="mt-1 text-xs text-emerald-100/80">You can now log in using your new password.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to={role === 'doctor' ? '/login/doctor' : '/login/patient'}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/30"
                >
                  Go to Login
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    resetFlow();
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                >
                  Reset Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showToast ? (
          <motion.div
            className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-[0_14px_50px_rgba(16,185,129,0.28)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <ShieldCheck className="h-4 w-4" />
            Password updated successfully
          </motion.div>
        ) : null}
      </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, icon, ...props }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 transition focus-within:border-cyan-300/50 focus-within:ring-1 focus-within:ring-cyan-300/35">
        <span className="text-slate-400">{icon}</span>
        <input
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
      </div>
    </label>
  );
}

function ActionButton({ onClick, disabled, loading, label, variant = 'primary' }) {
  const variantClass = variant === 'secondary'
    ? 'border-white/15 bg-white/10 text-slate-100 hover:bg-white/20'
    : 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/25';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {!loading && variant === 'secondary' ? <RefreshCw className="h-4 w-4" /> : null}
      {!loading && variant === 'primary' ? <ShieldX className="h-4 w-4" /> : null}
      {label}
    </button>
  );
}
