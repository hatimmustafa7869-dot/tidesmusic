import React from 'react';
import { ListMusic, Play } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { Equalizer } from './Equalizer';
import type { Track } from '../types';

interface TrackCardProps {
  item: Track | any;
  onSelectPlaylist?: (playlistId: string) => void;
  className?: string;
  tracksContext?: Track[];
  index?: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  item,
  onSelectPlaylist,
  className = '',
  tracksContext,
  index = 0
}) => {
  const { playTrack, playPlaylist, currentTrack, isPlaying } = useAudio();

  const isPlaylist = item.type === 'playlist' || !item.duration;
  const isCurrent = currentTrack?.id === item.id;

  const handleClick = () => {
    if (isPlaylist) {
      if (onSelectPlaylist) onSelectPlaylist(item.id);
    } else if (tracksContext && tracksContext.length > 0) {
      playPlaylist(tracksContext, index);
    } else {
      playTrack(item);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-white/[0.015] hover:from-white/[0.14] hover:via-white/[0.07] hover:to-white/[0.03] backdrop-blur-2xl border border-white/[0.1] hover:border-cyan-400/40 cursor-pointer transition-all duration-300 select-none hover:-translate-y-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(0,242,254,0.18)] overflow-hidden gpu-layer ${className}`}
    >
      {/* Top Specular Edge Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

      {/* Artwork Container */}
      <div className="relative aspect-square w-full rounded-xl shadow-lg overflow-hidden bg-black/40 mb-3 border border-white/[0.08]">
        <img
          src={item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Floating Futuristic Play Button */}
        <div
          className={`absolute bottom-2.5 right-2.5 transition-all duration-200 ease-out transform ${
            isCurrent && isPlaying
              ? 'translate-y-0 opacity-100 shadow-2xl scale-100'
              : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 shadow-xl'
          }`}
        >
          <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-gradient-to-tr from-[#1ed760] to-[#00f2fe] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-[0_4px_20px_rgba(0,242,254,0.5)] transition ring-1 ring-white/30">
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
        <div className="flex items-center gap-1.5">
          <h4
            className={`text-xs sm:text-sm font-bold line-clamp-2 leading-snug transition-colors flex-1 ${
              isCurrent ? 'text-[#00f2fe]' : 'text-white group-hover:text-[#00f2fe]'
            }`}
            title={item.title}
          >
            {item.title}
          </h4>
          {isCurrent && isPlaying && (
            <Equalizer isPlaying={true} variant="futuristic" className="h-2.5 shrink-0" />
          )}
        </div>
        <p
          className="text-[11px] sm:text-xs text-white/50 group-hover:text-white/80 line-clamp-1 transition-colors mt-1 flex items-center gap-1.5"
          title={item.artist}
        >
          <span>{item.artist || (isPlaylist ? 'Playlist' : 'Song')}</span>
          {isCurrent && <span className="hud-chip py-0 px-1 text-[8px]">LIVE</span>}
        </p>
      </div>
    </div>
  );
};
