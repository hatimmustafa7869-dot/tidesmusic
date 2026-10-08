import React from 'react';
import { Clock, Play, Trash2 } from 'lucide-react';
import { TrackRow } from '../components/TrackRow';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../types';

interface HistoryPageProps {
  onOpenAddToPlaylist: (track: Track) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onOpenAddToPlaylist }) => {
  const { history, clearHistory } = useLibrary();
  const { playPlaylist } = useAudio();

  const handlePlayAll = () => {
    if (history.length > 0) {
      playPlaylist(history, 0);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-[#282828] pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#1ed760]" />
            Recently Played
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Tracks you recently listened to on SoundFlow
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <>
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play All
              </button>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-medium border border-zinc-800 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
            <Clock className="w-12 h-12 stroke-1 opacity-40 text-red-500" />
            <p className="text-base font-semibold">No playback history</p>
            <p className="text-xs text-zinc-600">Start playing songs and they will appear here.</p>
          </div>
        ) : (
          history.map((track, idx) => (
            <TrackRow
              key={`${track.id}-${idx}`}
              track={track}
              index={idx}
              tracksContext={history}
              onAddToPlaylist={onOpenAddToPlaylist}
            />
          ))
        )}
      </div>
    </div>
  );
};
