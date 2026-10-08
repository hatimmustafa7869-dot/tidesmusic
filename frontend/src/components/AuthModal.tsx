import React, { useState } from 'react';
import { Disc3, Loader2, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#121212] border border-[#282828] rounded-2xl p-8 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-[#282828] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-lg shadow-[#1ed760]/20 mb-3">
            <Disc3 className="w-7 h-7 animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {mode === 'login' ? 'Log in to Tides Music' : 'Sign up for free'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Save your playlists & liked songs permanently across devices
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex bg-[#1e1e1e] p-1 rounded-xl mb-6 border border-[#2a2a2a]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === 'login' ? 'bg-[#282828] text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === 'register' ? 'bg-[#282828] text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#333] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#333] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#333] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#333] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-extrabold text-sm tracking-wide shadow-xl transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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

        <div className="mt-6 text-center text-xs text-zinc-400">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-white hover:underline font-bold"
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
                }}
                className="text-white hover:underline font-bold"
              >
                Log in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
