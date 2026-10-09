import React from 'react';
import { Home, Library, Plus, Radio, Search } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenJam: () => void;
  onOpenCreate: () => void;
  onOpenLibrary?: () => void;
  isJamActive?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenJam,
  onOpenCreate,
  onOpenLibrary,
  isJamActive = false
}) => {
  return (
    <nav className="md:hidden z-40 bg-[#080b12]/90 backdrop-blur-3xl border-t border-white/[0.1] px-3 py-1.5 select-none flex items-center justify-around shrink-0 shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
      {/* 1. Home */}
      <button
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-150 active:scale-90 ${
          currentView === 'home' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Home className={`w-5 h-5 transition ${currentView === 'home' ? 'text-[#1ed760] scale-110' : ''}`} />
        <span className={`text-[10px] font-semibold mt-1 ${currentView === 'home' ? 'text-white font-bold' : ''}`}>
          Home
        </span>
      </button>

      {/* 2. Search */}
      <button
        onClick={() => onNavigate('search')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-150 active:scale-90 ${
          currentView === 'search' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Search className={`w-5 h-5 transition ${currentView === 'search' ? 'text-[#1ed760] scale-110' : ''}`} />
        <span className={`text-[10px] font-semibold mt-1 ${currentView === 'search' ? 'text-white font-bold' : ''}`}>
          Search
        </span>
      </button>

      {/* 3. Your Library */}
      <button
        onClick={() => {
          if (onOpenLibrary) {
            onOpenLibrary();
          } else {
            onNavigate('favorites');
          }
        }}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-150 active:scale-90 ${
          currentView === 'favorites' || currentView === 'playlist' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Library className={`w-5 h-5 transition ${currentView === 'favorites' || currentView === 'playlist' ? 'text-[#1ed760] scale-110' : ''}`} />
        <span className={`text-[10px] font-semibold mt-1 ${currentView === 'favorites' || currentView === 'playlist' ? 'text-white font-bold' : ''}`}>
          Your Library
        </span>
      </button>

      {/* 4. Jam */}
      <button
        onClick={onOpenJam}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-zinc-400 hover:text-zinc-200 transition-all duration-150 active:scale-90 relative"
      >
        <div className="relative">
          <Radio className={`w-5 h-5 transition ${isJamActive ? 'text-[#1ed760] scale-110' : ''}`} />
          {isJamActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#1ed760] animate-ping" />
          )}
        </div>
        <span className={`text-[10px] font-semibold mt-1 ${isJamActive ? 'text-[#1ed760] font-bold' : ''}`}>
          {isJamActive ? 'Live Jam' : 'Jam'}
        </span>
      </button>

      {/* 5. Create / Import */}
      <button
        onClick={onOpenCreate}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-zinc-400 hover:text-zinc-200 transition-all duration-150 active:scale-90"
      >
        <Plus className="w-5 h-5" />
        <span className="text-[10px] font-semibold mt-1">Create</span>
      </button>
    </nav>
  );
};
