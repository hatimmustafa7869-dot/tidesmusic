import React from 'react';
import { ListMusic, Trash2, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const { queue, queueIndex, playPlaylist, removeFromQueue, clearQueue } = useAudio();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#121212] border-l border-[#282828] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none pb-[90px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#282828]">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-[#1ed760]" />
          <h3 className="font-bold text-white text-base">Queue</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#242424] text-[#b3b3b3]">
            {queue.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="text-xs text-[#b3b3b3] hover:text-[#1ed760] flex items-center gap-1 transition px-2 py-1 rounded hover:bg-[#242424]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#242424] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-[#b3b3b3]">
            <ListMusic className="w-12 h-12 stroke-1 mb-2 opacity-40 text-[#1ed760]" />
            <p className="text-sm font-bold text-white">Queue is empty</p>
            <p className="text-xs text-[#b3b3b3] mt-1">Play any song or playlist to queue tracks</p>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex;
            return (
              <div
                key={`${track.id}-${idx}`}
                className={`group flex items-center justify-between p-2 rounded-md transition ${
                  isCurrent ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'
                }`}
              >
                <div
                  onClick={() => playPlaylist(queue, idx)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 bg-[#242424]">
                    <img
                      src={track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate min-w-0">
                    <div
                      className={`text-sm truncate font-medium ${
                        isCurrent ? 'text-[#1ed760] font-bold' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-xs text-[#b3b3b3] truncate">
                      {track.artist}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#b3b3b3] font-mono">
                    {track.durationFormatted || '3:30'}
                  </span>
                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="p-1 text-[#b3b3b3] hover:text-white rounded opacity-0 group-hover:opacity-100 transition"
                    title="Remove from queue"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-[#282828] bg-[#0c0c0c] text-center">
        <p className="text-[11px] text-[#b3b3b3]">
          Tides Auto-Radio enabled &bull; Plays related songs when queue ends
        </p>
      </div>
    </div>
  );
};
