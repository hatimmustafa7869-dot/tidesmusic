import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login'
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);

  // Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [devCodeNotice, setDevCodeNotice] = useState('');

  if (!isOpen) return null;

  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!identifier.trim() || !password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        await login(identifier.trim(), password);
      } else {
        if (!username.trim() || !email.trim() || !password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        await register(username.trim(), email.trim(), password);
      }
      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setDevCodeNotice('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setSuccessMsg(res.message || 'Verification code sent to your email.');
      if (res.devCode) {
        setDevCodeNotice(res.devCode);
      }
      setLoading(false);
      setMode('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset code');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!resetCode.trim() || resetCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword(email.trim(), resetCode.trim(), newPassword);
      setSuccessMsg(res.message || 'Password reset successfully!');
      setLoading(false);
      setTimeout(() => {
        setMode('login');
        setIdentifier(email);
        setPassword('');
        setSuccessMsg('You can now log in with your new password.');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-fade-in">
      {/* Ambient background glow */}
      <div className="absolute w-72 h-72 bg-gradient-to-tr from-[#1ed760]/20 to-[#0ea5e9]/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#0a0d14]/85 backdrop-blur-3xl border border-white/[0.14] rounded-3xl p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden">
        {/* Subtle top edge specular highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/[0.08] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 group">
            <img
              src="/logo.png"
              alt="Tides Music"
              className="w-14 h-14 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,210,255,0.25)] border border-white/20"
            />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {mode === 'login' && 'Log in to Tides Music'}
            {mode === 'register' && 'Sign up for free'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-[280px]">
            {mode === 'login' && 'Sync playlists, favorites & history across all your devices'}
            {mode === 'register' && 'Create your account to unlock cloud library backup'}
            {mode === 'forgot' && 'Enter your registered email and we will send a 6-digit reset code via Hostinger SMTP'}
            {mode === 'reset' && `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {/* Mode Toggle Tabs (Only shown for login / register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-white/[0.05] p-1 rounded-2xl mb-5 border border-white/[0.08] backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-200 ${
                mode === 'login'
                  ? 'bg-white text-black font-extrabold shadow-lg scale-[1.02]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-200 ${
                mode === 'register'
                  ? 'bg-white text-black font-extrabold shadow-lg scale-[1.02]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center font-medium backdrop-blur-md animate-fade-in">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs text-center font-medium backdrop-blur-md flex items-center justify-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {devCodeNotice && (
          <div className="mb-4 p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs text-center font-medium backdrop-blur-md">
            Dev notice: Your verification code is <strong className="text-white font-mono text-sm tracking-widest">{devCodeNotice}</strong>
          </div>
        )}

        {/* 1. LOGIN / REGISTER FORM */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleLoginOrRegister} className="space-y-4">
            {mode === 'login' ? (
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-[#1ed760] hover:text-[#1fdf64] hover:underline font-semibold transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-extrabold text-sm tracking-wide shadow-[0_0_20px_rgba(30,215,96,0.35)] transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Please wait...
                  </>
                ) : mode === 'login' ? (
                  'Log In'
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2. FORGOT PASSWORD (EMAIL INPUT) */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                  autoFocus
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-extrabold text-sm tracking-wide shadow-[0_0_20px_rgba(30,215,96,0.35)] transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Sending Reset Code...
                  </>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Log In
              </button>
            </div>
          </form>
        )}

        {/* 3. RESET PASSWORD (OTP + NEW PASSWORD) */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full pl-10 pr-4 py-2.5 font-mono text-center tracking-[0.4em] text-lg bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] focus:border-[#1ed760] focus:ring-2 focus:ring-[#1ed760]/20 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-extrabold text-sm tracking-wide shadow-[0_0_20px_rgba(30,215,96,0.35)] transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Resend Code or Change Email
              </button>
            </div>
          </form>
        )}

        {/* Footer switch between login and register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="mt-6 text-center text-xs text-zinc-400">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-white hover:underline font-bold transition"
                >
                  Sign up for free
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-white hover:underline font-bold transition"
                >
                  Log in here
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
