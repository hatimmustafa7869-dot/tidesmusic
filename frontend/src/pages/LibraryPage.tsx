import React, { useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  Download,
  FolderPlus,
  Heart,
  LayoutGrid,
  List,
  ListMusic,
  Play,
  Plus,
  Search
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Playlist, Track } from '../types';

interface LibraryPageProps {
  onSelectPlaylist: (playlistId: string) => void;
  onOpenCreatePlaylist: () => void;
  onOpenImportPlaylist: () => void;
  onNavigateFavorites: () => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onSelectPlaylist,
  onOpenCreatePlaylist,
  onOpenImportPlaylist,
  onNavigateFavorites
}) => {
  const { playlists, favorites } = useLibrary();
  const { playPlaylist } = useAudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'playlists' | 'liked'>('all');
  const [sortBy, setSortBy] = useState<'recents' | 'az' | 'count'>('recents');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort playlists
  const filteredPlaylists = useMemo(() => {
    let list = [...playlists];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'az') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'count') {
      list.sort((a, b) => (b.itemCount ?? b.tracks?.length ?? 0) - (a.itemCount ?? a.tracks?.length ?? 0));
    }

    return list;
  }, [playlists, searchQuery, sortBy]);

  const handlePlayPlaylistDirect = (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    if (pl.tracks && pl.tracks.length > 0) {
      playPlaylist(pl.tracks, 0);
    } else {
      onSelectPlaylist(pl.id);
    }
  };

  const handlePlayLikedDirect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.length > 0) {
      playPlaylist(favorites, 0);
    } else {
      onNavigateFavorites();
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* 1. Page Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your Library</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 shadow-[0_0_12px_rgba(30,215,96,0.25)]">
              {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Saved playlists, liked tracks, and personal music collection
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenImportPlaylist}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 text-xs font-bold text-zinc-200 hover:text-white transition shadow-sm backdrop-blur-xl"
            title="Import YouTube or Spotify Playlist"
          >
            <Download className="w-4 h-4 text-[#1ed760]" />
            <span>Import</span>
          </button>

          <button
            onClick={onOpenCreatePlaylist}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-xs font-extrabold text-black transition shadow-[0_0_16px_rgba(30,215,96,0.4)]"
            title="Create New Playlist"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Pills, Search Bar, Sort & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition duration-150 shrink-0 ${
              activeTab === 'all'
                ? 'bg-white text-black font-extrabold shadow-sm scale-102'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] backdrop-blur-md'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition duration-150 shrink-0 ${
              activeTab === 'playlists'
                ? 'bg-white text-black font-extrabold shadow-sm scale-102'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] backdrop-blur-md'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition duration-150 shrink-0 ${
              activeTab === 'liked'
                ? 'bg-white text-black font-extrabold shadow-sm scale-102'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] backdrop-blur-md'
            }`}
          >
            Liked Songs ({favorites.length})
          </button>
        </div>

        {/* Search, Sort & Grid/List Toggle */}
        <div className="flex items-center gap-2">
          {/* Real-time search inside library */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.05] border border-white/[0.08] focus:border-[#1ed760] rounded-full text-xs text-white placeholder-zinc-500 focus:outline-none transition backdrop-blur-md"
            />
          </div>

          {/* Sort By Toggle */}
          <button
            onClick={() => {
              if (sortBy === 'recents') setSortBy('az');
              else if (sortBy === 'az') setSortBy('count');
              else setSortBy('recents');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-full text-xs font-bold text-zinc-300 hover:text-white transition shrink-0"
            title="Cycle Sort Order"
          >
            <ArrowDownAZ className="w-3.5 h-3.5 text-[#1ed760]" />
            <span>{sortBy === 'az' ? 'A - Z' : sortBy === 'count' ? 'Most Songs' : 'Recents'}</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-white/[0.05] border border-white/[0.08] p-0.5 rounded-full shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition ${
                viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition ${
                viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Library Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pt-2">
          {/* Liked Songs Featured Tile (Always first when All or Liked is selected) */}
          {(activeTab === 'all' || activeTab === 'liked') && (
            <div
              onClick={onNavigateFavorites}
              className="group relative col-span-2 sm:col-span-2 h-48 sm:h-56 rounded-2xl sm:rounded-3xl p-5 bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] text-white overflow-hidden cursor-pointer shadow-[0_12px_36px_rgba(69,10,245,0.35)] hover:shadow-[0_16px_48px_rgba(69,10,245,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none transform translate-x-10 -translate-y-10" />

              <div className="flex items-center justify-between z-10">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner border border-white/20">
                  <Heart className="w-7 h-7 fill-white text-white drop-shadow" />
                </div>
                <button
                  onClick={handlePlayLikedDirect}
                  className="w-12 h-12 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 hover:scale-105 active:scale-95"
                  title="Play Liked Songs"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                </button>
              </div>

              <div className="z-10">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/80">Playlist</span>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 drop-shadow">
                  Liked Songs
                </h3>
                <p className="text-xs text-white/90 font-medium mt-1">
                  {favorites.length} {favorites.length === 1 ? 'favorite track' : 'favorite tracks'}
                </p>
              </div>
            </div>
          )}

          {/* User & Saved Playlists Grid Cards */}
          {(activeTab === 'all' || activeTab === 'playlists') &&
            filteredPlaylists.map(pl => {
              const count = pl.itemCount ?? pl.tracks?.length ?? 0;
              const thumb = pl.thumbnail || (pl.tracks && pl.tracks[0] ? pl.tracks[0].thumbnail : '');

              return (
                <div
                  key={pl.id}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className="group relative flex flex-col bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.2] rounded-2xl p-3 sm:p-3.5 cursor-pointer transition-all duration-300 shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] hover:-translate-y-1"
                >
                  {/* Specular Edge Highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none rounded-t-2xl" />

                  {/* Thumbnail Container */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#181d28] shadow-md mb-3">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-emerald-800 to-teal-950 flex items-center justify-center">
                        <ListMusic className="w-10 h-10 text-white/60" />
                      </div>
                    )}

                    {/* Floating Play Button on Hover */}
                    <button
                      onClick={(e) => handlePlayPlaylistDirect(e, pl)}
                      className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 hover:scale-108 active:scale-95 z-10"
                      title={`Play ${pl.title}`}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
                    </button>
                  </div>

                  {/* Title & Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate tracking-tight group-hover:text-[#1ed760] transition-colors">
                      {pl.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                      Playlist &bull; {count} {count === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* 4. List View Mode */
        <div className="space-y-1.5 pt-1">
          {/* Liked Songs List Item */}
          {(activeTab === 'all' || activeTab === 'liked') && (
            <div
              onClick={onNavigateFavorites}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] cursor-pointer transition group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] flex items-center justify-center shadow shrink-0">
                  <Heart className="w-6 h-6 fill-white text-white" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white group-hover:text-[#1ed760] transition truncate">
                    Liked Songs
                  </div>
                  <div className="text-xs text-zinc-400 font-medium mt-0.5">
                    Playlist &bull; {favorites.length} songs
                  </div>
                </div>
              </div>

              <button
                onClick={handlePlayLikedDirect}
                className="w-9 h-9 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition hover:scale-105 active:scale-95 shrink-0"
              >
                <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
              </button>
            </div>
          )}

          {/* Playlists List Items */}
          {(activeTab === 'all' || activeTab === 'playlists') &&
            filteredPlaylists.map(pl => {
              const count = pl.itemCount ?? pl.tracks?.length ?? 0;
              const thumb = pl.thumbnail || (pl.tracks && pl.tracks[0] ? pl.tracks[0].thumbnail : '');

              return (
                <div
                  key={pl.id}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#181d28] shadow shrink-0">
                      {thumb ? (
                        <img src={thumb} alt={pl.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-emerald-800 to-teal-950 flex items-center justify-center">
                          <ListMusic className="w-6 h-6 text-white/60" />
                        </div>
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white group-hover:text-[#1ed760] transition truncate">
                        {pl.title}
                      </div>
                      <div className="text-xs text-zinc-400 font-medium mt-0.5">
                        Playlist &bull; {count} {count === 1 ? 'song' : 'songs'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handlePlayPlaylistDirect(e, pl)}
                    className="w-9 h-9 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition hover:scale-105 active:scale-95 shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* 5. Empty State when user has no playlists matching filter */}
      {filteredPlaylists.length === 0 && activeTab === 'playlists' && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-400">
            <FolderPlus className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-base font-bold text-white">No playlists found</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
            {searchQuery
              ? `No playlists matched "${searchQuery}". Try a different keyword.`
              : 'Create your first playlist or import an existing one from YouTube or Spotify.'}
          </p>
          {!searchQuery && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onOpenCreatePlaylist}
                className="px-4 py-2 rounded-full bg-[#1ed760] text-black font-extrabold text-xs hover:scale-105 active:scale-95 transition"
              >
                Create Playlist
              </button>
              <button
                onClick={onOpenImportPlaylist}
                className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs border border-white/10 transition"
              >
                Import Playlist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
