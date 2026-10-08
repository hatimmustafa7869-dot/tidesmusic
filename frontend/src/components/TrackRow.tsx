import React, { useState } from 'react';
import { Heart, ListPlus, ListStart, MoreHorizontal, Play } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../types';

import { Equalizer } from './Equalizer';

interface TrackRowProps {
  track: Track;
  index: number;
  tracksContext?: Track[];
  onAddToPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  tracksContext,
  onAddToPlaylist,
  onRemoveFromPlaylist
}) => {
  const { currentTrack, isPlaying, playTrack, playPlaylist, playNextInQueue, addToQueue } = useAudio();
  const { isFavorite, toggleFavorite } = useLibrary();
  const [showMenu, setShowMenu] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isFav = isFavorite(track.id);

  const handlePlay = () => {
    if (tracksContext && tracksContext.length > 0) {
      playPlaylist(tracksContext, index);
    } else {
      playTrack(track);
    }
  };

  return (
    <div
      onDoubleClick={handlePlay}
      className={`group relative flex items-center justify-between px-4 py-2 rounded-md transition select-none ${
        isCurrent ? 'bg-[#282828]/70' : 'hover:bg-[#2a2a2a]/50'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Track Number / Play Icon / Equalizer */}
        <div className="w-5 text-center flex items-center justify-center shrink-0">
          {isCurrent && isPlaying ? (
            <Equalizer isPlaying={true} className="w-3.5 h-3.5" barColor="bg-[#1ed760]" />
          ) : (
            <>
              <span className={`text-sm group-hover:hidden font-mono ${isCurrent ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}`}>
                {index + 1}
              </span>
              <button
                onClick={handlePlay}
                className="hidden group-hover:flex text-white hover:scale-110 transition"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail */}
        <div
          onClick={handlePlay}
          className="relative w-10 h-10 rounded overflow-hidden shrink-0 cursor-pointer shadow bg-[#242424]"
        >
          <img
            src={track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1 pr-4">
          <div
            onClick={handlePlay}
            className={`text-sm truncate cursor-pointer hover:underline ${
              isCurrent ? 'text-[#1ed760] font-bold' : 'text-white font-medium'
            }`}
          >
            {track.title}
          </div>
          <div className="text-xs text-[#b3b3b3] truncate mt-0.5 hover:underline hover:text-white cursor-pointer">
            {track.artist || 'Unknown Artist'}
          </div>
        </div>
      </div>

      {/* Right: Heart, Duration, 3-dots */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track);
          }}
          className={`p-1 transition ${
            isFav
              ? 'text-[#1ed760]'
              : 'text-[#b3b3b3] hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title={isFav ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        <span className="text-xs text-[#b3b3b3] font-mono w-10 text-right">
          {track.durationFormatted || '3:30'}
        </span>

        {/* Context Menu Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-[#b3b3b3] hover:text-white transition opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#282828] border border-[#3e3e3e] rounded-md shadow-2xl py-1 z-50 text-xs text-white">
                <button
                  onClick={() => {
                    playNextInQueue(track);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-zinc-300 hover:text-white hover:bg-[#3e3e3e] text-left transition"
                >
                  <ListStart className="w-4 h-4 text-zinc-400" />
                  Play next
                </button>
                <button
                  onClick={() => {
                    addToQueue(track);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-zinc-300 hover:text-white hover:bg-[#3e3e3e] text-left transition"
                >
                  <ListPlus className="w-4 h-4 text-zinc-400" />
                  Add to queue
                </button>
                {onAddToPlaylist && (
                  <button
                    onClick={() => {
                      onAddToPlaylist(track);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-zinc-300 hover:text-white hover:bg-[#3e3e3e] text-left transition"
                  >
                    <ListPlus className="w-4 h-4 text-zinc-400" />
                    Add to playlist
                  </button>
                )}
                {onRemoveFromPlaylist && (
                  <button
                    onClick={() => {
                      onRemoveFromPlaylist(track.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-left transition"
                  >
                    Remove from playlist
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
