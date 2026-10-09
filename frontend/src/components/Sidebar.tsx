import React, { useState } from 'react';
import {
  ArrowDownAZ,
  ArrowDownCircle,
  Download,
  Heart,
  Home,
  LayoutGrid,
  Library,
  List,
  ListMusic,
  Plus,
  Radio,
  Search,
  X
} from 'lucide-react';
import { useJam } from '../context/JamContext';
import { useLibrary } from '../context/LibraryContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
  onOpenCreatePlaylist: () => void;
  onOpenImportPlaylist: () => void;
  onOpenDownloadApp?: () => void;
  selectedPlaylistId?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenCreatePlaylist,
  onOpenImportPlaylist,
  onOpenDownloadApp,
  selectedPlaylistId,
  isOpenMobile,
  onCloseMobile
}) => {
  const { playlists, favorites } = useLibrary();
  const { isJamActive, participants, setIsJamModalOpen } = useJam();

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'liked'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recents' | 'az' | 'count'>('recents');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const handleNav = (view: string, data?: any) => {
    if (view === 'library') {
      onNavigate('favorites', data);
    } else {
      onNavigate(view, data);
    }
    if (onCloseMobile) onCloseMobile();
  };

  // Only the playlists the user adds should show here
  const baseList = playlists;

  // Apply search query filter
  let processedList = baseList.filter(p =>
    p.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Apply sort
  if (sortBy === 'az') {
    processedList = [...processedList].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'count') {
    processedList = [...processedList].sort((a, b) => (b.itemCount || 0) - (a.itemCount || 0));
  }

  const cycleSort = () => {
    if (sortBy === 'recents') setSortBy('az');
    else if (sortBy === 'az') setSortBy('count');
    else setSortBy('recents');
  };

  const getSortLabel = () => {
    if (sortBy === 'az') return 'A - Z';
    if (sortBy === 'count') return 'Most Songs';
    return 'Recents';
  };

  const showLikedSongs = activeFilter === 'all' || activeFilter === 'liked';
  const showPlaylists = activeFilter === 'all' || activeFilter === 'playlists';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0b0e17]/65 backdrop-blur-3xl rounded-3xl select-none text-zinc-400 p-3.5 overflow-hidden border border-white/[0.12] shadow-[0_16px_48px_rgba(0,0,0,0.6)] relative">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {/* Mobile Top Navigation Links */}
      <div className="md:hidden flex flex-col gap-1 pb-3 mb-2 border-b border-white/[0.08]">
        <button
          onClick={() => handleNav('home')}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-sm transition ${
            currentView === 'home' ? 'bg-white/[0.1] text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Home className="w-5 h-5 text-[#1ed760]" />
          <span>Home</span>
        </button>
        <button
          onClick={() => handleNav('search')}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-sm transition ${
            currentView === 'search' ? 'bg-white/[0.1] text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Search className="w-5 h-5 text-[#1ed760]" />
          <span>Search</span>
        </button>
        <button
          onClick={() => {
            setIsJamModalOpen(true);
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex items-center justify-between px-3 py-2 rounded-xl font-bold text-sm text-zinc-300 hover:text-white hover:bg-white/[0.04] transition"
        >
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-[#1ed760]" />
            <span>Spotify Jam</span>
          </div>
          {isJamActive ? (
            <span className="px-2 py-0.5 rounded-full bg-[#1ed760] text-black text-[10px] font-black animate-pulse">
              LIVE ({participants.length})
            </span>
          ) : (
            <span className="text-[11px] text-zinc-500 font-semibold">Start</span>
          )}
        </button>
      </div>

      {/* Top Header: "Your Library" */}
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <button
          onClick={() => handleNav('favorites')}
          className="flex items-center gap-2.5 text-base font-bold text-zinc-300 hover:text-white transition group"
        >
          <Library className="w-5 h-5 text-zinc-400 group-hover:text-[#1ed760] transition" />
          <span className="text-sm font-extrabold tracking-tight text-zinc-200 group-hover:text-white">Your Library</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenImportPlaylist}
            title="Import Playlist"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-full transition"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCreatePlaylist}
            title="Create Playlist"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-full transition"
          >
            <Plus className="w-5 h-5" />
          </button>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              title="Close Menu"
              className="md:hidden p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-full transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills Row (All, Playlists, Liked Songs) */}
      <div className="flex items-center gap-1.5 px-1 pb-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
            activeFilter === 'all'
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06] backdrop-blur-md'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveFilter('playlists')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
            activeFilter === 'playlists'
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06] backdrop-blur-md'
          }`}
        >
          Playlists
        </button>
        <button
          onClick={() => setActiveFilter('liked')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
            activeFilter === 'liked'
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06] backdrop-blur-md'
          }`}
        >
          Liked Songs
        </button>
      </div>

      {/* Sub-bar: Search, Sort Selector, Grid/List Toggle */}
      <div className="flex items-center justify-between px-1 py-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2 flex-1">
          {isSearchOpen ? (
            <div className="relative flex-1 flex items-center bg-[#242424] rounded px-2 py-1">
              <Search className="w-3.5 h-3.5 text-zinc-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Search library"
                className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                autoFocus
              />
              <button onClick={() => { setIsSearchOpen(false); setFilterQuery(''); }}>
                <X className="w-3 h-3 text-zinc-400 hover:text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 hover:text-white hover:bg-white/5 rounded-full transition"
              title="Search in Library"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {!isSearchOpen && (
            <button
              onClick={cycleSort}
              className="flex items-center gap-1.5 font-semibold text-zinc-400 hover:text-white transition text-xs hover:bg-white/5 px-2 py-1 rounded"
              title="Click to change sorting order"
            >
              <ArrowDownAZ className="w-3.5 h-3.5 text-zinc-500" />
              <span>{getSortLabel()}</span>
            </button>
          )}
        </div>

        {/* View Mode Toggle: Grid vs List */}
        <button
          onClick={() => setViewMode(prev => (prev === 'grid' ? 'list' : 'grid'))}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition"
          title={viewMode === 'grid' ? 'Switch to List view' : 'Switch to Grid view'}
        >
          {viewMode === 'grid' ? (
            <LayoutGrid className="w-4 h-4" />
          ) : (
            <List className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Content Area: Grid View vs List View */}
      <div className="flex-1 overflow-y-auto pr-1 mt-1 space-y-1">
        {viewMode === 'grid' ? (
          /* 2-Column Square Grid */
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* 1. Liked Songs Purple Card */}
            {showLikedSongs && (
              <div
                onClick={() => handleNav('favorites')}
                className="group cursor-pointer flex flex-col p-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <div className="aspect-square w-full rounded-md bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] flex items-center justify-center shadow-lg relative overflow-hidden group-hover:scale-102 transition duration-200">
                  <Heart className="w-8 h-8 text-white fill-current drop-shadow-md" />
                </div>
                <div className="mt-1.5 px-0.5 min-w-0">
                  <div className={`text-xs font-bold truncate ${currentView === 'favorites' ? 'text-[#1ed760]' : 'text-white'}`}>
                    Liked Songs
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    Playlist &bull; {favorites.length} songs
                  </div>
                </div>
              </div>
            )}

            {/* Playlists Grid Items */}
            {showPlaylists &&
              processedList.map(pl => {
                const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;
                return (
                  <div
                    key={pl.id}
                    onClick={() => handleNav('playlist', { playlistId: pl.id })}
                    className="group cursor-pointer flex flex-col p-1.5 rounded-lg hover:bg-white/5 transition"
                  >
                    <div className="aspect-square w-full rounded-md overflow-hidden bg-[#242424] shadow relative group-hover:scale-102 transition duration-200">
                      {pl.thumbnail ? (
                        <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-pink-600 to-indigo-700">
                          <ListMusic className="w-8 h-8 text-white/80" />
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 px-0.5 min-w-0">
                      <div className={`text-xs font-bold truncate ${isSelected ? 'text-[#1ed760]' : 'text-white'}`}>
                        {pl.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        Playlist &bull; {pl.author || 'Tides'}
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Empty state when user has not added playlists yet */}
            {showPlaylists && processedList.length === 0 && (
              <div className="bg-[#1e1e1e] p-3.5 rounded-xl border border-white/5 space-y-2.5 col-span-2 my-1">
                <div className="space-y-0.5">
                  <h4 className="text-white font-bold text-xs">Create your first playlist</h4>
                  <p className="text-[11px] text-zinc-400">It's easy, we'll help you organize your favorites.</p>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    onClick={onOpenCreatePlaylist}
                    className="w-full py-1.5 bg-white text-black font-bold text-xs rounded-full hover:scale-102 active:scale-98 transition shadow"
                  >
                    Create playlist
                  </button>
                  <button
                    onClick={onOpenImportPlaylist}
                    className="w-full py-1.5 bg-[#282828] hover:bg-[#333] text-white font-semibold text-xs rounded-full transition"
                  >
                    Import playlist
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List View Mode */
          <div className="space-y-0.5">
            {/* Liked Songs Row */}
            {showLikedSongs && (
              <div
                onClick={() => handleNav('favorites')}
                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition ${
                  currentView === 'favorites' ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="w-12 h-12 rounded bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] flex items-center justify-center shrink-0 shadow">
                  <Heart className="w-5 h-5 text-white fill-current" />
                </div>
                <div className="truncate min-w-0">
                  <div className={`text-sm font-bold truncate ${currentView === 'favorites' ? 'text-[#1ed760]' : 'text-white'}`}>
                    Liked Songs
                  </div>
                  <div className="text-xs text-zinc-400 truncate flex items-center gap-1">
                    <span>📌 Playlist</span>
                    <span>&bull;</span>
                    <span>{favorites.length} songs</span>
                  </div>
                </div>
              </div>
            )}

            {/* Playlists Rows */}
            {showPlaylists &&
              processedList.map(pl => {
                const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;
                return (
                  <div
                    key={pl.id}
                    onClick={() => handleNav('playlist', { playlistId: pl.id })}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition ${
                      isSelected ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-[#282828] flex items-center justify-center shadow">
                      {pl.thumbnail ? (
                        <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                      ) : (
                        <ListMusic className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="truncate min-w-0">
                      <div className={`text-sm font-bold truncate ${isSelected ? 'text-[#1ed760]' : 'text-white'}`}>
                        {pl.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        Playlist &bull; {pl.author || 'Tides'}
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Empty state when user has not added playlists yet */}
            {showPlaylists && processedList.length === 0 && (
              <div className="bg-[#1e1e1e] p-3.5 rounded-xl border border-white/5 space-y-2.5 my-1">
                <div className="space-y-0.5">
                  <h4 className="text-white font-bold text-xs">Create your first playlist</h4>
                  <p className="text-[11px] text-zinc-400">It's easy, we'll help you organize your favorites.</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={onOpenCreatePlaylist}
                    className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded-full hover:scale-102 active:scale-98 transition shadow"
                  >
                    Create playlist
                  </button>
                  <button
                    onClick={onOpenImportPlaylist}
                    className="px-3 py-1.5 bg-[#282828] hover:bg-[#333] text-white font-semibold text-xs rounded-full transition"
                  >
                    Import playlist
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Download App CTA */}
      <div className="pt-2 px-1 border-t border-white/[0.08] shrink-0 mt-auto">
        <button
          onClick={onOpenDownloadApp}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-gradient-to-r from-white/[0.08] to-white/[0.03] hover:from-white/[0.14] hover:to-white/[0.06] border border-white/[0.1] text-white transition group shadow-md hover:scale-[1.02] active:scale-[0.98] backdrop-blur-xl"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Tides" className="w-6 h-6 rounded-lg object-cover shadow" />
            <div className="text-left min-w-0">
              <p className="text-xs font-bold text-white group-hover:text-[#1ed760] transition truncate">Get Tides App</p>
              <p className="text-[10px] text-zinc-400 truncate">For Phone (APK) & PC</p>
            </div>
          </div>
          <ArrowDownCircle className="w-4 h-4 text-[#1ed760] shrink-0" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 lg:w-72 xl:w-80 h-full shrink-0 select-none">
        {sidebarContent}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[85vw] h-full bg-black shadow-2xl z-10 animate-in slide-in-from-left duration-200 p-2">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
