import React, { useState } from 'react';
import {
  CheckCircle2,
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  PanelRight,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useJam } from '../context/JamContext';
import { useLibrary } from '../context/LibraryContext';
import { Equalizer } from './Equalizer';

interface PlayerProps {
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
  onOpenNowPlaying: () => void;
  isQueueOpen: boolean;
  isLyricsOpen?: boolean;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
}

export const Player: React.FC<PlayerProps> = ({
  onOpenLyrics,
  onOpenQueue,
  onOpenNowPlaying,
  isQueueOpen,
  isLyricsOpen = false,
  isRightSidebarOpen = false,
  onToggleRightSidebar
}) => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat
  } = useAudio();

  const { isFavorite, toggleFavorite } = useLibrary();
  const { isJamActive, jamId, participants, setIsJamModalOpen } = useJam();
  const [isScrubberHovered, setIsScrubberHovered] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(true);

  if (!currentTrack) {
    return null;
  }

  const isFav = isFavorite(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remainingSeconds = Math.max(0, (duration || 0) - currentTime);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  return (
    <div className="relative z-40 bg-[#000000] border-t border-[#282828] select-none text-white shrink-0">
      {/* Top Edge Progress Bar for Mobile */}
      <div
        className="md:hidden absolute top-0 left-0 right-0 h-[2.5px] bg-zinc-800 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          seek(ratio * (duration || 0));
        }}
      >
        <div
          className="h-full bg-[#1ed760] transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Floating Active Jam Sync Pill */}
      {isJamActive && (
        <div
          onClick={() => setIsJamModalOpen(true)}
          className="absolute -top-7 left-1/2 transform -translate-x-1/2 px-3 py-0.5 rounded-t-lg bg-black/90 border border-b-0 border-[#1ed760]/40 text-white text-[11px] font-bold flex items-center gap-2 shadow-lg backdrop-blur-md cursor-pointer hover:bg-zinc-900 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-ping" />
          <span className="text-[#1ed760] font-black">Jam:</span>
          <span className="font-mono">{jamId}</span>
          <span className="text-zinc-400 font-normal">({participants.length} in sync)</span>
        </div>
      )}

      {/* 1. Mobile Player View (< md) */}
      <div className="md:hidden flex items-center justify-between h-16 px-3 gap-2">
        {/* Track Details & Thumbnail (Click to open Fullscreen Now Playing) */}
        <div
          onClick={onOpenNowPlaying}
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer py-1"
        >
          <div className="relative w-11 h-11 rounded overflow-hidden shrink-0 shadow bg-[#282828]">
            <img
              src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
              <span className="truncate">{currentTrack.title}</span>
              <Equalizer isPlaying={isPlaying} className="w-3 h-3 shrink-0" />
            </div>
            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
              {currentTrack.artist || 'Unknown Artist'}
            </div>
          </div>
        </div>

        {/* Mobile Action Controls: Jam, Like, Play/Pause, Next */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={() => setIsJamModalOpen(true)}
            className={`p-1.5 transition ${isJamActive ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'}`}
            title="Start or Join a Jam"
          >
            <Radio className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleFavorite(currentTrack)}
            className="p-1.5 transition active:scale-125 text-[#1ed760]"
            title={isFav ? 'Added to Liked Songs' : 'Save to Liked Songs'}
          >
            {isFav ? (
              <CheckCircle2 className="w-5 h-5 fill-[#1ed760] text-black" />
            ) : (
              <Heart className="w-5 h-5 text-zinc-400 hover:text-white" />
            )}
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition shadow-lg shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current text-black" />
            ) : (
              <Play className="w-4 h-4 fill-current text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-1.5 text-zinc-300 hover:text-white transition active:scale-110"
            title="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {/* 2. Desktop Player View (md and up) */}
      <div className="hidden md:flex items-center justify-between gap-4 h-[84px] px-4 py-2.5">
        {/* Left: Track Details */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px] max-w-[320px]">
          <div
            onClick={onOpenNowPlaying}
            className="relative w-14 h-14 rounded overflow-hidden shrink-0 cursor-pointer shadow group bg-[#282828]">
          <img
            src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
            alt={currentTrack.title}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            onClick={onOpenNowPlaying}
            className="flex items-center gap-2 text-sm font-bold text-white truncate cursor-pointer hover:underline"
          >
            <span className="truncate">{currentTrack.title}</span>
            <Equalizer isPlaying={isPlaying} className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xs text-zinc-400 truncate mt-0.5 hover:underline hover:text-white cursor-pointer font-medium">
            {currentTrack.artist || 'Unknown Artist'}
          </div>
        </div>

        {/* Liked Status Button */}
        <button
          onClick={() => toggleFavorite(currentTrack)}
          className="p-1 transition active:scale-125 shrink-0 text-[#1ed760]"
          title={isFav ? 'Added to Liked Songs' : 'Save to Liked Songs'}
        >
          {isFav ? (
            <CheckCircle2 className="w-5 h-5 fill-[#1ed760] text-black" />
          ) : (
            <Heart className="w-5 h-5 text-zinc-400 hover:text-white" />
          )}
        </button>
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-[720px]">
        {/* Transport Controls */}
        <div className="flex items-center gap-4 md:gap-5">
          <button
            onClick={toggleShuffle}
            className={`p-1 transition relative ${
              shuffle ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
            }`}
            title="Enable Shuffle"
          >
            <Shuffle className="w-4 h-4" />
            {shuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1ed760]" />}
          </button>

          <button
            onClick={prevTrack}
            className="text-zinc-400 hover:text-white transition"
            title="Previous track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition shadow-lg shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current text-black" />
            ) : (
              <Play className="w-4 h-4 fill-current text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="text-zinc-400 hover:text-white transition"
            title="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-1 transition relative ${
              repeat !== 'off' ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
            }`}
            title={`Repeat mode: ${repeat}`}
          >
            {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            {repeat !== 'off' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1ed760]" />}
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-zinc-400 font-mono w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            className="relative flex-1 flex items-center group py-2.5 cursor-pointer select-none touch-none"
            onMouseEnter={() => setIsScrubberHovered(true)}
            onMouseLeave={() => setIsScrubberHovered(false)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              seek(ratio * (duration || 0));
            }}
          >
            <div className="w-full h-1 group-hover:h-1.5 bg-[#4d4d4d] rounded-full overflow-hidden transition-all duration-150">
              <div
                className={`h-full transition-all duration-75 ${
                  isScrubberHovered ? 'bg-[#1ed760]' : 'bg-white'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onInput={e => seek(parseFloat((e.target as HTMLInputElement).value))}
              onChange={e => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            {/* Custom Thumb knob on hover */}
            {isScrubberHovered && (
              <div
                className="absolute w-3 h-3 bg-white rounded-full pointer-events-none -ml-1.5 shadow"
                style={{ left: `${progressPercent}%` }}
              />
            )}
          </div>

          <span
            onClick={() => setShowRemainingTime(!showRemainingTime)}
            className="text-[11px] text-zinc-400 hover:text-white font-mono w-12 text-left cursor-pointer transition select-none"
            title="Click to toggle remaining / total duration"
          >
            {showRemainingTime ? `-${formatTime(remainingSeconds)}` : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right Controls: Only Working Functional Buttons */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        {/* Lyrics */}
        <button
          onClick={onOpenLyrics}
          className={`p-1.5 transition ${
            isLyricsOpen ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
          }`}
          title="Lyrics"
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Queue */}
        <button
          onClick={onOpenQueue}
          className={`p-1.5 transition ${
            isQueueOpen ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
          }`}
          title="Playing Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Jam Collaborative Listening Button */}
        <button
          onClick={() => setIsJamModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
            isJamActive
              ? 'bg-[#1ed760] text-black shadow-[0_0_12px_rgba(30,215,96,0.5)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title={isJamActive ? `In Jam (${participants.length} listeners)` : 'Start or Join a Jam'}
        >
          <Radio className="w-4 h-4" />
          {isJamActive && <span className="font-mono">Jam ({participants.length})</span>}
        </button>

        {/* Volume Scrubber */}
        <div
          className="flex items-center gap-1.5 group w-24"
          onMouseEnter={() => setIsVolumeHovered(true)}
          onMouseLeave={() => setIsVolumeHovered(false)}
        >
          <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition p-1" title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-[#1ed760]" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <div className="relative flex-1 flex items-center py-2 cursor-pointer">
            <div className="w-full h-1 bg-[#4d4d4d] rounded-full overflow-hidden">
              <div
                className={`h-full ${isVolumeHovered ? 'bg-[#1ed760]' : 'bg-white'}`}
                style={{ width: `${volumePercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            {isVolumeHovered && (
              <div
                className="absolute w-2.5 h-2.5 bg-white rounded-full pointer-events-none -ml-1.25 shadow"
                style={{ left: `${volumePercent}%` }}
              />
            )}
          </div>
        </div>

        {/* Fullscreen Player Modal */}
        <button
          onClick={onOpenNowPlaying}
          className="p-1.5 text-zinc-400 hover:text-white transition"
          title="Full screen view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Now Playing Right Sidebar Toggle */}
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className={`p-1.5 transition ${
              isRightSidebarOpen ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
            }`}
            title="Now playing side view"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  </div>
  );
};
