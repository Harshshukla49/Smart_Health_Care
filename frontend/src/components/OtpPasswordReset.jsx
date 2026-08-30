import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  KeyRound,
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
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
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
    if (resendIn <= 0) return undefined;
    const timer = setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    return () => {
      clearPhoneOtpSession();
    };
  }, []);

  const handleSendOtp = async () => {
    const trimmed = String(phone || '').trim();
    if (!trimmed) {
      setError('Please enter your registered phone number with country code (e.g. +91XXXXXXXXXX).');
      return;
    }

    setError('');
    setInfo('');
    setLoadingAction('send');

    try {
      await sendOTP(trimmed);
      setMaskedPhone(trimmed.replace(/^(\+?\d{2,3})(\d+)(\d{4})$/, '$1******$3'));
      setStep(2);
      setResendIn(DEFAULT_RESEND_SECONDS);
      setInfo('Verification code sent via SMS.');
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Failed to dispatch SMS verification code.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setInfo('');
    setLoadingAction('verify');

    try {
      const userCredential = await verifyOTP(otp);
      const user = userCredential?.user;
      if (!user) throw new Error('Firebase phone verification failed.');

      const token = await user.getIdToken();
      setFirebaseIdToken(token);

      const verificationResult = await verifyFirebasePhoneToken({
        idToken: token,
        role,
      });

      if (!verificationResult?.verified) {
        throw new Error(verificationResult?.message || 'Phone number does not match registered records.');
      }

      setStep(3);
      setInfo('Code verified. Set your new password.');
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Verification code incorrect or expired.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
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
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Failed to update password.'
      );
    } finally {
      setLoadingAction('');
    }
  };

  const renderStepTitle = () => {
    if (step === 1) return 'Step 1: Enter registered phone number';
    if (step === 2) return 'Step 2: Verify OTP code';
    if (step === 3) return 'Step 3: Create new password';
    return 'Step 4: Recovery Complete';
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
        className="inline-flex w-full items-center justify-between rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-[#1677FF] hover:bg-sky-100/60 transition"
      >
        <span className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          <span>{isOpen ? 'Hide account recovery' : 'Forgot password? Reset with phone OTP'}</span>
        </span>
        <span className="rounded-md bg-white border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-[#1677FF]">
          OTP RECOVERY
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 shadow-xs text-left"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1677FF]">
                  Account Recovery
                </p>
                <h3 className="font-sans text-sm font-bold text-[#0F2747]">
                  {roleLabel} Password Reset
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{renderStepTitle()}</p>
              </div>
            </div>

            {info ? (
              <motion.div
                className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {info}
              </motion.div>
            ) : null}

            {error ? (
              <motion.div
                className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700"
                initial={{ opacity: 0, y: 4 }}
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
                  className="space-y-3"
                >
                  <Field
                    label="Registered Phone Number"
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
                    label="Send SMS Code"
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
                  className="space-y-3"
                >
                  <Field
                    label="6-Digit SMS Verification Code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    disabled={isLoading}
                  />

                  <div className="flex flex-wrap gap-2.5">
                    <ActionButton
                      onClick={handleVerifyOtp}
                      disabled={isLoading}
                      loading={loadingAction === 'verify'}
                      label="Verify Code"
                    />
                    <ActionButton
                      onClick={handleSendOtp}
                      disabled={isLoading || resendIn > 0}
                      loading={loadingAction === 'send'}
                      label={resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend Code'}
                      variant="secondary"
                    />
                  </div>

                  {maskedPhone ? (
                    <p className="text-xs text-slate-500">Sent to {maskedPhone}.</p>
                  ) : null}
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="step-3"
                  variants={fadeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-3"
                >
                  <Field
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    icon={<Lock className="h-4 w-4" />}
                    disabled={isLoading}
                  />
                  <Field
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    disabled={isLoading}
                  />

                  <ActionButton
                    onClick={handleResetPassword}
                    disabled={isLoading || !firebaseIdToken}
                    loading={loadingAction === 'reset'}
                    label="Save New Password"
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
                >
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">
                          Password updated successfully
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          You can now sign in using your updated password.
                        </p>
                      </div>
                    </div>
                  </div>
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
    <label className="block space-y-1 text-left">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs transition focus-within:border-[#1677FF] focus-within:ring-2 focus-within:ring-blue-100">
        <span className="text-slate-400">{icon}</span>
        <input
          className="w-full bg-transparent text-xs text-[#0F2747] outline-none placeholder:text-slate-400"
          {...props}
        />
      </div>
    </label>
  );
}

function ActionButton({ onClick, disabled, loading, label, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isPrimary
          ? 'bg-[#1677FF] text-white hover:bg-blue-600 shadow-xs'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
      {!loading && variant === 'secondary' ? <RefreshCw className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}
