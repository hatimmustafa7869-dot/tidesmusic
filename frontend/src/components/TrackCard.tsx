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
      className="group relative flex flex-col p-4 rounded-md bg-[#181818] hover:bg-[#282828] cursor-pointer transition duration-300 select-none"
    >
      {/* Artwork Container */}
      <div className="relative aspect-square w-full rounded shadow-lg overflow-hidden bg-[#242424] mb-3">
        <img
          src={item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Floating Green Play Button - iconic Spotify feature */}
        <div
          className={`absolute bottom-2 right-2 transition-all duration-200 ease-out transform ${
            isCurrent && isPlaying
              ? 'translate-y-0 opacity-100 shadow-2xl'
              : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 shadow-xl'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg">
            {isPlaylist ? (
              <ListMusic className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-white truncate">
          {item.title}
        </h4>
        <p className="text-xs text-[#b3b3b3] truncate mt-1">
          {item.artist || (isPlaylist ? 'Playlist' : 'Song')}
        </p>
      </div>
    </div>
  );
};
