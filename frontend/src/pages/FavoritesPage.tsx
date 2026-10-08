import React from 'react';
import { Clock, Heart, Play, Shuffle } from 'lucide-react';
import { TrackRow } from '../components/TrackRow';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../types';

interface FavoritesPageProps {
  onOpenAddToPlaylist: (track: Track) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({ onOpenAddToPlaylist }) => {
  const { favorites } = useLibrary();
  const { playPlaylist, toggleShuffle } = useAudio();
  const { user } = useAuth();

  const handlePlayAll = () => {
    if (favorites.length > 0) {
      playPlaylist(favorites, 0);
    }
  };

  const handleShufflePlay = () => {
    if (favorites.length > 0) {
      toggleShuffle();
      const randIdx = Math.floor(Math.random() * favorites.length);
      playPlaylist(favorites, randIdx);
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-fade-in-up">
      {/* Spotify Giant Liked Songs Banner */}
      <div className="relative -mx-4 md:-mx-8 -mt-6 p-6 md:p-8 pt-10 bg-gradient-to-b from-[#4c1d95] via-[#1e1b4b]/90 to-[#121212] flex flex-col sm:flex-row items-center sm:items-end gap-6 select-none">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-md bg-gradient-to-br from-indigo-700 via-purple-600 to-emerald-700 flex items-center justify-center text-white shadow-2xl shrink-0">
          <Heart className="w-24 h-24 fill-current animate-pulse" />
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Playlist
          </span>
          <h1 className="text-3xl sm:text-6xl md:text-7xl font-black text-white tracking-tight">
            Liked Songs
          </h1>
          <div className="text-xs sm:text-sm text-zinc-300 flex items-center justify-center sm:justify-start gap-1.5 font-medium pt-2">
            <strong className="text-white">{user?.username || 'You'}</strong>
            <span>&bull;</span>
            <span>{favorites.length} {favorites.length === 1 ? 'song' : 'songs'}</span>
          </div>
        </div>
      </div>

      {/* Action Controls Row */}
      <div className="flex items-center gap-6 px-2 py-2">
        <button
          onClick={handlePlayAll}
          disabled={favorites.length === 0}
          className="w-14 h-14 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 disabled:opacity-50 text-black flex items-center justify-center shadow-xl transition"
          title="Play"
        >
          <Play className="w-6 h-6 fill-current ml-0.5" />
        </button>

        <button
          onClick={handleShufflePlay}
          disabled={favorites.length === 0}
          className="text-[#b3b3b3] hover:text-white transition"
          title="Shuffle"
        >
          <Shuffle className="w-6 h-6" />
        </button>
      </div>

      {/* Table Header */}
      <div className="border-b border-[#282828] pb-2 px-4 flex items-center justify-between text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider">
        <div className="flex items-center gap-4 flex-1">
          <span className="w-5 text-center">#</span>
          <span>Title</span>
        </div>
        <div className="flex items-center gap-4">
          <Clock className="w-4 h-4 mr-10" />
        </div>
      </div>

      {/* Track Rows */}
      <div className="space-y-0.5">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#b3b3b3] gap-2">
            <Heart className="w-12 h-12 stroke-1 opacity-40 text-[#1ed760]" />
            <p className="text-base font-bold text-white">Songs you like will appear here</p>
            <p className="text-xs text-[#b3b3b3]">Save songs by clicking the heart icon.</p>
          </div>
        ) : (
          favorites.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              tracksContext={favorites}
              onAddToPlaylist={onOpenAddToPlaylist}
            />
          ))
        )}
      </div>
    </div>
  );
};
