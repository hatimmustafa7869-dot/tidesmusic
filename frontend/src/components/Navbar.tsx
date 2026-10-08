import React, { useState } from 'react';
import {
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  LogOut,
  Search,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onSearch: (query: string) => void;
  onNavigateHome: () => void;
  onOpenMobileMenu: () => void;
  onOpenImport: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  initialQuery?: string;
  showSearchBar?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onOpenDownloadApp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearch,
  onNavigateHome,
  onOpenMobileMenu,
  onOpenImport,
  onOpenAuth,
  onOpenDownloadApp,
  initialQuery = '',
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      onSearch(val.trim());
    }
  };

  const initialLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'T';

  return (
    <header className="h-14 px-4 flex items-center justify-between gap-4 select-none shrink-0 bg-black text-white">
      {/* Left: Tides Logo & Navigation History Arrows */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
          title="Open Library Menu"
        >
          <img src="/logo.png" alt="Tides" className="w-7 h-7 rounded-lg object-cover shadow" />
        </button>

        {/* Desktop Brand Logo */}
        <div
          onClick={onNavigateHome}
          className="hidden md:flex items-center gap-2.5 cursor-pointer group pr-1"
          title="Tides Music"
        >
          <img
            src="/logo.png"
            alt="Tides Music"
            className="w-8 h-8 rounded-lg object-cover shadow-lg group-hover:scale-105 transition duration-200 border border-white/10"
          />
          <span className="hidden xl:inline text-base font-black tracking-tight text-white group-hover:text-[#1ed760] transition">
            TIDES
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center transition ${
              canGoBack
                ? 'text-zinc-200 hover:text-white hover:bg-[#282828] cursor-pointer'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className={`w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center transition ${
              canGoForward
                ? 'text-zinc-200 hover:text-white hover:bg-[#282828] cursor-pointer'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Go forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center: Home Button & Spotify Search Pill */}
      <div className="flex items-center gap-2 flex-1 max-w-[540px] justify-center">
        {/* Round Home Button */}
        <button
          onClick={onNavigateHome}
          className="w-12 h-12 rounded-full bg-[#1f1f1f] hover:bg-[#282828] hover:scale-105 active:scale-95 text-white flex items-center justify-center transition shadow shrink-0"
          title="Home"
        >
          <Home className="w-5 h-5 fill-current" />
        </button>

        {/* Unified Search Pill */}
        <form
          onSubmit={handleSubmit}
          className="relative flex-1 flex items-center bg-[#1f1f1f] hover:bg-[#282828] focus-within:bg-[#1f1f1f] focus-within:border-white/40 border border-transparent rounded-full px-3.5 py-2.5 transition duration-200"
        >
          <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-2" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="What do you want to play?"
            className="w-full bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onSearch('');
              }}
              className="text-zinc-400 hover:text-white ml-1 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Right: Download App, Import & Profile / Auth */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Download App Action Button */}
        <button
          onClick={onOpenDownloadApp}
          title="Download Tides Music App (APK & PC)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1ed760]/10 hover:bg-[#1ed760]/20 border border-[#1ed760]/30 text-[#1ed760] hover:text-white text-xs font-bold transition hover:scale-105 active:scale-95 shadow-sm"
        >
          <ArrowDownCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Download App</span>
        </button>

        {/* Import Playlist Quick Action */}
        <button
          onClick={onOpenImport}
          title="Import Playlist"
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-zinc-300 hover:text-white transition"
        >
          <Download className="w-3.5 h-3.5 text-[#1ed760]" />
          <span>Import</span>
        </button>

        {/* Profile Avatar / Auth */}
        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative p-0.5 rounded-full hover:scale-105 active:scale-95 transition"
              title={user?.username}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] text-white flex items-center justify-center text-sm font-black shadow-md border-2 border-[#121212]">
                {initialLetter}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#1ed760] border-2 border-black rounded-full" />
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#282828] rounded-lg shadow-2xl p-1.5 z-50 text-xs border border-zinc-700 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 text-zinc-400 border-b border-zinc-700/60 truncate">
                    Account: <strong className="text-white block truncate">{user?.username}</strong>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-[#3e3e3e] rounded text-left transition font-semibold mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-extrabold text-xs tracking-wider transition hover:scale-105 shadow"
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
