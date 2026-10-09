import React, { useState } from 'react';
import {
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  LogOut,
  Radio,
  Search,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useJam } from '../context/JamContext';

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
  const { isJamActive, setIsJamModalOpen, participants } = useJam();
  const [query, setQuery] = useState(initialQuery);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val.trim());
  };

  const initialLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'T';

  return (
    <header className="h-14 px-2 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 select-none shrink-0 bg-[#090d16]/80 backdrop-blur-3xl border-b border-white/[0.12] text-white z-30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Left: Mobile Library Menu & Brand Logo & Navigation History Arrows */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Mobile Library Menu Toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 text-zinc-300 hover:text-white rounded-xl hover:bg-white/[0.08] active:scale-95 transition"
          title="Open Library Menu"
        >
          <img src="/logo.png" alt="Tides" className="w-7 h-7 rounded-lg object-cover shadow-[0_0_12px_rgba(0,210,255,0.3)] border border-white/20" />
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
            className="w-8 h-8 rounded-xl object-cover shadow-[0_0_16px_rgba(0,210,255,0.35)] group-hover:scale-105 transition duration-200 border border-white/20"
          />
          <span className="hidden xl:inline text-base font-black tracking-tight text-white group-hover:text-[#1ed760] transition">
            TIDES <span className="text-[#1ed760] font-bold text-xs tracking-widest uppercase ml-0.5">Music</span>
          </span>
        </div>

        {/* Desktop History Navigation Arrows (Hidden on mobile) */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-xl flex items-center justify-center transition ${
              canGoBack
                ? 'text-zinc-200 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] cursor-pointer'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className={`w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-xl flex items-center justify-center transition ${
              canGoForward
                ? 'text-zinc-200 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] cursor-pointer'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Go forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center: Home Button & Spotify Search Pill */}
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[540px] justify-center">
        {/* Desktop Round Home Button (Hidden on mobile to provide maximum space for search) */}
        <button
          onClick={onNavigateHome}
          className="hidden md:flex w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.12] hover:border-white/[0.25] backdrop-blur-xl hover:scale-105 active:scale-95 text-white items-center justify-center transition shadow-sm shrink-0"
          title="Home"
        >
          <Home className="w-4 h-4 fill-current" />
        </button>

        {/* Spacious Responsive Search Bar */}
        <form
          onSubmit={handleSubmit}
          className="relative flex-1 min-w-0 flex items-center bg-white/[0.07] hover:bg-white/[0.1] focus-within:bg-white/[0.12] border border-white/[0.14] focus-within:border-[#1ed760]/60 focus-within:ring-2 focus-within:ring-[#1ed760]/20 backdrop-blur-2xl rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 transition duration-200 shadow-inner"
        >
          <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-zinc-400 shrink-0 mr-2" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search songs, artists..."
            className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onSearch('');
              }}
              className="text-zinc-400 hover:text-white ml-1 p-0.5 shrink-0"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Right: Jam, Download App, Import & Profile / Auth */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Spotify Jam Quick Button (Always accessible on Mobile & Desktop) */}
        <button
          onClick={() => setIsJamModalOpen(true)}
          title={isJamActive ? `In Jam (${participants.length} listeners)` : "Spotify Jam"}
          className={`flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full border text-xs font-bold transition hover:scale-105 active:scale-95 shadow-sm shrink-0 ${
            isJamActive
              ? 'bg-[#1ed760] text-black border-[#1ed760] shadow-[0_0_14px_rgba(30,215,96,0.6)] animate-pulse'
              : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white backdrop-blur-md'
          }`}
        >
          <Radio className={`w-4 h-4 shrink-0 ${isJamActive ? 'text-black' : 'text-[#1ed760]'}`} />
          <span className="hidden sm:inline">{isJamActive ? `Jam (${participants.length})` : 'Jam'}</span>
        </button>

        {/* Download App Action Button */}
        <button
          onClick={onOpenDownloadApp}
          title="Download Tides Music App (APK & PC)"
          className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-[#1ed760]/10 hover:bg-[#1ed760]/20 border border-[#1ed760]/30 text-[#1ed760] hover:text-white text-xs font-bold transition hover:scale-105 active:scale-95 shadow-sm shrink-0"
        >
          <ArrowDownCircle className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Download App</span>
        </button>

        {/* Import Playlist Quick Action */}
        <button
          onClick={onOpenImport}
          title="Import Playlist"
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition backdrop-blur-md"
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
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#0c0c0e]/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-1.5 z-50 text-xs border border-white/[0.1] animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 text-zinc-400 border-b border-white/[0.08] truncate">
                    Account: <strong className="text-white block truncate">{user?.username}</strong>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-white/[0.08] rounded-xl text-left transition font-semibold mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-2.5 sm:px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-extrabold text-xs tracking-wider transition hover:scale-105 shadow-md shrink-0"
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
