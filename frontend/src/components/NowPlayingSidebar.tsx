import React, { useEffect, useState } from 'react';
import { CheckCircle2, Heart, Mic2, Music, Play, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';

interface NowPlayingSidebarProps {
  onClose: () => void;
  onOpenLyricsModal: () => void;
}

export const NowPlayingSidebar: React.FC<NowPlayingSidebarProps> = ({
  onClose,
  onOpenLyricsModal
}) => {
  const { currentTrack, queue, queueIndex, playTrack } = useAudio();
  const { isFavorite, toggleFavorite } = useLibrary();

  const [lyricsSnippet, setLyricsSnippet] = useState<string>('');
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!currentTrack) return;
    setLyricsLoading(true);
    api.getLyrics(currentTrack.id)
      .then(res => {
        if (res.available && res.lyrics) {
          // Take first few lines as preview snippet
          const lines = res.lyrics
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('['));
          setLyricsSnippet(lines.slice(0, 3).join('\n') || res.lyrics.slice(0, 120));
        } else {
          setLyricsSnippet('No lyrics preview available for this track.');
        }
        setLyricsLoading(false);
      })
      .catch(() => {
        setLyricsSnippet('Lyrics preview unavailable.');
        setLyricsLoading(false);
      });
  }, [currentTrack]);

  if (!currentTrack) {
    return (
      <aside className="hidden xl:flex flex-col w-80 h-full bg-[#0c0c0e]/60 backdrop-blur-2xl rounded-2xl p-4 select-none shrink-0 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <span className="text-sm font-bold text-white">Now Playing</span>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-3">
          <Music className="w-12 h-12 text-zinc-600 animate-pulse" />
          <p className="text-sm font-semibold">Play a song to view details, lyrics preview, and credits.</p>
        </div>
      </aside>
    );
  }

  const isFav = isFavorite(currentTrack.id);
  const nextTrack = queue[queueIndex + 1];

  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 h-full bg-[#0c0c0e]/60 backdrop-blur-2xl rounded-2xl select-none shrink-0 overflow-hidden border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
        <span className="text-sm font-bold text-white truncate max-w-[190px]">
          {isFav ? 'Liked Songs' : currentTrack.artist || 'Now Playing'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-3">
        {/* Large Album Artwork */}
        <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-2xl bg-[#1e1e1e] group">
          <img
            src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
            alt={currentTrack.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        </div>

        {/* Track Title, Artist & Liked Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white hover:underline cursor-pointer truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-semibold hover:underline cursor-pointer truncate mt-0.5">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack)}
            className="p-1 text-[#1ed760] hover:scale-110 active:scale-95 transition shrink-0"
            title={isFav ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            {isFav ? (
              <CheckCircle2 className="w-6 h-6 fill-[#1ed760] text-black" />
            ) : (
              <Heart className="w-6 h-6 text-zinc-400 hover:text-white" />
            )}
          </button>
        </div>

        {/* Lyrics Preview Glass Card */}
        <div
          onClick={onOpenLyricsModal}
          className="bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-xl rounded-2xl p-4 transition-all duration-300 cursor-pointer border border-white/[0.08] hover:border-white/[0.14] space-y-2 group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Lyrics preview</span>
            <Mic2 className="w-4 h-4 text-[#1ed760] group-hover:scale-110 transition" />
          </div>

          {lyricsLoading ? (
            <p className="text-xs text-zinc-400 animate-pulse">Loading lyrics preview...</p>
          ) : (
            <p className="text-zinc-200 text-sm font-semibold leading-relaxed line-clamp-3 italic">
              {lyricsSnippet}
            </p>
          )}

          <div className="pt-1 flex items-center justify-between text-[11px] font-bold text-zinc-400 group-hover:text-white">
            <span>Tap to view full lyrics</span>
            <span className="text-[#1ed760]">&rarr;</span>
          </div>
        </div>

        {/* Next in Queue Preview Glass Card */}
        {nextTrack && (
          <div className="bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md rounded-2xl p-3 border border-white/[0.06] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Next in queue</span>
            </div>
            <div
              onClick={() => playTrack(nextTrack)}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img
                src={nextTrack.thumbnail}
                alt={nextTrack.title}
                className="w-10 h-10 rounded-xl object-cover shrink-0 shadow"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white truncate block group-hover:text-[#1ed760] transition">
                  {nextTrack.title}
                </span>
                <span className="text-[11px] text-zinc-400 truncate block">
                  {nextTrack.artist}
                </span>
              </div>
              <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
