import React from 'react';
import { ListMusic, Play } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Track } from '../types';

interface TrackCardProps {
  item: Track | any;
  onSelectPlaylist?: (playlistId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({ item, onSelectPlaylist }) => {
  const { playTrack, currentTrack, isPlaying } = useAudio();

  const isPlaylist = item.type === 'playlist' || !item.duration;
  const isCurrent = currentTrack?.id === item.id;

  const handleClick = () => {
    if (isPlaylist) {
      if (onSelectPlaylist) onSelectPlaylist(item.id);
    } else {
      playTrack(item);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/[0.06] hover:border-white/[0.14] cursor-pointer transition-all duration-300 select-none hover:-translate-y-1 shadow-sm hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)]"
    >
      {/* Artwork Container */}
      <div className="relative aspect-square w-full rounded-xl shadow-md overflow-hidden bg-black/40 mb-2.5">
        <img
          src={item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Floating Green Play Button - iconic Spotify feature */}
        <div
          className={`absolute bottom-2 right-2 transition-all duration-200 ease-out transform ${
            isCurrent && isPlaying
              ? 'translate-y-0 opacity-100 shadow-2xl scale-100'
              : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 shadow-xl'
          }`}
        >
          <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition">
            {isPlaylist ? (
              <ListMusic className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 mt-0.5">
        <h4
          className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-[#1ed760] transition-colors"
          title={item.title}
        >
          {item.title}
        </h4>
        <p
          className="text-[11px] sm:text-xs text-white/50 group-hover:text-white/80 line-clamp-1 transition-colors mt-1"
          title={item.artist}
        >
          {item.artist || (isPlaylist ? 'Playlist' : 'Song')}
        </p>
      </div>
    </div>
  );
};
