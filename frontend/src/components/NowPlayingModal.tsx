import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ChevronDown,
  Heart,
  ListMusic,
  Loader2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';

interface NowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedLyricLine {
  id: number;
  text: string;
  time: number;
  formattedTime: string;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    shuffle,
    repeat,
    volume,
    isMuted,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    queue,
    queueIndex,
    playPlaylist
  } = useAudio();

  const { isFavorite, toggleFavorite } = useLibrary();

  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [rawLyrics, setRawLyrics] = useState<string>('');
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false);
  const [isScrubberHovered, setIsScrubberHovered] = useState<boolean>(false);
  const [scrubberHoverTime, setScrubberHoverTime] = useState<number | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  // User scrolling & seek feedback
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [flashLineId, setFlashLineId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollTimeoutRef = useRef<any>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack || !isOpen) return;

    setLyricsLoading(true);
    api.getLyrics(currentTrack.id)
      .then(res => {
        setRawLyrics(res.lyrics || '');
        setLyricsLoading(false);
      })
      .catch(() => {
        setRawLyrics('');
        setLyricsLoading(false);
      });
  }, [currentTrack?.id, isOpen]);

  // Keyboard shortcut to close (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Parse lyrics into line items with time coordinates
  const parsedLyrics = useMemo<ParsedLyricLine[]>(() => {
    if (!rawLyrics || !rawLyrics.trim()) return [];

    const rawLines = rawLyrics
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('Source:') && !l.startsWith('Written by:'));

    if (rawLines.length === 0) return [];

    // 1. Check for standard synced LRC format: [mm:ss.xx] or [mm:ss]
    const lrcRegex = /^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)/;
    const hasLrc = rawLines.some(line => lrcRegex.test(line));

    if (hasLrc) {
      const parsed: ParsedLyricLine[] = [];
      rawLines.forEach((line, idx) => {
        const match = line.match(lrcRegex);
        if (match) {
          const mins = parseInt(match[1], 10);
          const secs = parseFloat(match[2]);
          const time = mins * 60 + secs;
          const text = match[3].trim();
          if (text) {
            const m = Math.floor(time / 60);
            const s = Math.floor(time % 60);
            parsed.push({
              id: idx,
              text,
              time,
              formattedTime: `${m}:${s < 10 ? '0' : ''}${s}`
            });
          }
        }
      });
      if (parsed.length > 0) return parsed;
    }

    // 2. Proportional Distribution for Plain Text Lyrics
    const total = rawLines.length;
    const dur = duration > 10 ? duration : 210;
    const startOffset = Math.max(4, Math.min(14, dur * 0.05));
    const endOffset = Math.max(6, Math.min(18, dur * 0.07));
    const span = Math.max(10, dur - startOffset - endOffset);

    return rawLines.map((line, idx) => {
      const progress = total > 1 ? idx / (total - 1) : 0;
      const time = Math.round((startOffset + progress * span) * 10) / 10;
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return {
        id: idx,
        text: line,
        time,
        formattedTime: `${m}:${s < 10 ? '0' : ''}${s}`
      };
    });
  }, [rawLyrics, duration]);

  // Find active line index
  const activeLineIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [parsedLyrics, currentTime]);

  // Auto-scroll active lyric into view
  useEffect(() => {
    if (isUserScrolling || activeLineIndex === -1 || activeTab !== 'lyrics') return;
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLineIndex, isUserScrolling, activeTab]);

  // Detect manual user scroll in lyrics
  const handleLyricsScroll = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4500);
  };

  // Jump to active line when user clicks "Back to sync"
  const scrollToActiveLine = () => {
    setIsUserScrolling(false);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Clicking on ANY part of the lyrics seeks and plays immediately!
  const handleLyricClick = (line: ParsedLyricLine) => {
    seek(line.time);
    if (!isPlaying) {
      togglePlay();
    }
    setFlashLineId(line.id);
    setTimeout(() => setFlashLineId(null), 700);

    setToastMessage(`Playing from ${line.formattedTime}`);
    setTimeout(() => setToastMessage(null), 2200);

    // Briefly pause user scrolling override so it centers right away
    setIsUserScrolling(false);
  };

  if (!isOpen || !currentTrack) return null;

  const isFav = isFavorite(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const displayTime = dragValue !== null ? dragValue : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleScrubberSeek = (val: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, val));
    seek(clamped);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex flex-col animate-in fade-in zoom-in-98 duration-200 overflow-hidden select-none">
      {/* 1. Dynamic Breathing Ambient Aura */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none blur-[100px] scale-125 transition-all duration-1000 ease-out animate-pulse"
        style={{
          backgroundImage: `url(${currentTrack.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }}
      />
      <div className="absolute inset-0 bg-radial-vignette opacity-80 pointer-events-none" />

      {/* Floating Animated Equalizer Accent in Background */}
      <div className="absolute bottom-0 left-0 right-0 h-44 opacity-15 pointer-events-none flex items-end justify-between gap-1 px-8 overflow-hidden">
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className={`w-full bg-gradient-to-t from-emerald-500 via-teal-400 to-transparent rounded-t-full transition-all duration-300 ${
              isPlaying ? 'animate-pulse' : 'h-2'
            }`}
            style={{
              height: isPlaying ? `${Math.sin(i * 0.4 + (currentTime % 10)) * 45 + 50}%` : '4%',
              animationDelay: `${(i % 12) * 120}ms`
            }}
          />
        ))}
      </div>

      {/* 2. Top Header Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-black/20">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition px-3.5 py-1.5 rounded-full hover:bg-white/10 active:scale-95 group shadow-sm"
        >
          <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-wider">Close</span>
        </button>

        {/* Brand Status Indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#1ed760] animate-ping' : 'bg-zinc-500'}`} />
          <span className="text-xs uppercase tracking-widest text-zinc-300 font-extrabold flex items-center gap-1.5">
            Playing on <span className="text-[#1ed760] font-black">Tides Music</span>
          </span>
        </div>

        {/* Tab Switcher: Lyrics vs Queue */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-full border border-white/10 shadow-inner">
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeTab === 'lyrics'
                ? 'bg-[#1ed760] text-black shadow-[0_0_15px_rgba(30,215,96,0.35)] scale-102'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Lyrics
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeTab === 'queue'
                ? 'bg-[#1ed760] text-black shadow-[0_0_15px_rgba(30,215,96,0.35)] scale-102'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            Queue ({queue.length})
          </button>
        </div>
      </div>

      {/* 3. Main Split View: Left Column (Art & Controls) + Right Column (Clickable Lyrics / Queue) */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 p-6 md:p-10 lg:p-12 overflow-y-auto max-w-7xl mx-auto w-full items-center">
        {/* LEFT COLUMN: Album Artwork & Comprehensive Playback Controls */}
        <div className="flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-6">
          {/* Cover Art with Vinyl Glow Effect */}
          <div className="relative group">
            {/* Spinning Vinyl Record Peek when Playing */}
            <div
              className={`absolute -right-6 top-3 w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 border-4 border-zinc-800 shadow-2xl transition-all duration-700 pointer-events-none flex items-center justify-center ${
                isPlaying ? 'opacity-90 translate-x-8 md:translate-x-12' : 'opacity-0 translate-x-0'
              }`}
              style={{
                animation: isPlaying ? 'spin 10s linear infinite' : 'none'
              }}
            >
              <div className="w-24 h-24 rounded-full border-2 border-zinc-700 bg-[#121212] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#1ed760]/80 shadow-inner" />
              </div>
            </div>

            {/* Front Album Card */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-zinc-900 border border-white/10 group-hover:scale-[1.02] transition-transform duration-300">
              <img
                src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Track Details & Favorite Button */}
          <div className="w-full flex items-center justify-between pt-2">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-xl md:text-2xl font-black text-white truncate tracking-tight hover:text-[#1ed760] transition-colors cursor-default">
                {currentTrack.title}
              </h2>
              <p className="text-sm md:text-base text-zinc-400 truncate mt-1 font-medium">
                {currentTrack.artist || 'Unknown Artist'}
              </p>
            </div>
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-3 rounded-full hover:bg-white/10 transition-all transform active:scale-125 ${
                isFav ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
              }`}
              title={isFav ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart className={`w-7 h-7 ${isFav ? 'fill-current drop-shadow-[0_0_12px_rgba(30,215,96,0.6)]' : ''}`} />
            </button>
          </div>

          {/* Interactive Progress Tracking Scrubber */}
          <div className="w-full space-y-2">
            <div
              className="relative w-full py-3 flex items-center cursor-pointer group select-none touch-none"
              onMouseEnter={() => setIsScrubberHovered(true)}
              onMouseLeave={() => {
                setIsScrubberHovered(false);
                setScrubberHoverTime(null);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                setScrubberHoverTime(ratio * (duration || 0));
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const newSecs = ratio * (duration || 0);
                handleScrubberSeek(newSecs);
              }}
            >
              {/* Scrubber Tooltip on Hover */}
              {isScrubberHovered && scrubberHoverTime !== null && (
                <div
                  className="absolute -top-7 px-2 py-0.5 bg-black/90 text-[#1ed760] text-[11px] font-mono font-bold rounded shadow border border-white/10 pointer-events-none transform -translate-x-1/2"
                  style={{
                    left: `${Math.max(5, Math.min(95, (scrubberHoverTime / (duration || 1)) * 100))}%`
                  }}
                >
                  {formatTime(scrubberHoverTime)}
                </div>
              )}

              {/* Background Track */}
              <div className="w-full h-1.5 group-hover:h-2.5 bg-white/15 rounded-full overflow-hidden transition-all duration-150 relative">
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    isScrubberHovered || dragValue !== null
                      ? 'bg-gradient-to-r from-emerald-500 to-[#1ed760] shadow-[0_0_10px_rgba(30,215,96,0.7)]'
                      : 'bg-white'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Scrub Knob Thumb */}
              <div
                className={`absolute w-4 h-4 bg-white rounded-full pointer-events-none -ml-2 shadow-lg transition-transform ${
                  isScrubberHovered || dragValue !== null ? 'scale-100 opacity-100 ring-2 ring-[#1ed760]' : 'scale-0 opacity-0'
                }`}
                style={{ left: `${progressPercent}%` }}
              />

              {/* Full-Area Range Input for Dragging */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={displayTime}
                onMouseDown={() => setDragValue(currentTime)}
                onTouchStart={() => setDragValue(currentTime)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                  const val = parseFloat((e.currentTarget as HTMLInputElement).value);
                  setDragValue(val);
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = parseFloat(e.target.value);
                  setDragValue(null);
                  handleScrubberSeek(val);
                }}
                onMouseUp={(e) => {
                  const val = parseFloat((e.currentTarget as HTMLInputElement).value);
                  setDragValue(null);
                  handleScrubberSeek(val);
                }}
                onTouchEnd={(e) => {
                  const val = parseFloat((e.currentTarget as HTMLInputElement).value);
                  setDragValue(null);
                  handleScrubberSeek(val);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>

            <div className="flex justify-between text-xs text-zinc-400 font-mono select-none px-0.5">
              <span>{formatTime(displayTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 w-full">
            <button
              onClick={toggleShuffle}
              className={`p-2.5 rounded-full transition-all relative ${
                shuffle ? 'text-[#1ed760] bg-white/5' : 'text-zinc-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
              {shuffle && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />}
            </button>

            <button
              onClick={() => handleScrubberSeek(Math.max(0, currentTime - 10))}
              className="text-zinc-400 hover:text-white transition p-2 rounded-full hover:bg-white/10 active:scale-90 flex flex-col items-center group relative"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-5 h-5 group-hover:scale-110 transition" />
              <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white">10s</span>
            </button>

            <button
              onClick={prevTrack}
              className="text-zinc-300 hover:text-white transition p-2 rounded-full hover:bg-white/10 active:scale-95"
              title="Previous song"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className={`w-16 h-16 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-all ${
                isPlaying
                  ? 'shadow-[0_0_30px_rgba(30,215,96,0.45)] ring-4 ring-emerald-500/20'
                  : 'shadow-2xl'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8 fill-current text-black" />
              ) : (
                <Play className="w-8 h-8 fill-current text-black ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="text-zinc-300 hover:text-white transition p-2 rounded-full hover:bg-white/10 active:scale-95"
              title="Next song"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={() => handleScrubberSeek(Math.min(duration || 99999, currentTime + 10))}
              className="text-zinc-400 hover:text-white transition p-2 rounded-full hover:bg-white/10 active:scale-90 flex flex-col items-center group relative"
              title="Forward 10 seconds"
            >
              <RotateCw className="w-5 h-5 group-hover:scale-110 transition" />
              <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white">10s</span>
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2.5 rounded-full transition-all relative ${
                repeat !== 'off' ? 'text-[#1ed760] bg-white/5' : 'text-zinc-400 hover:text-white'
              }`}
              title={`Repeat: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              {repeat !== 'off' && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />}
            </button>
          </div>

          {/* Integrated Volume Slider */}
          <div className="flex items-center gap-3 w-64 pt-2">
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="relative flex-1 flex items-center h-4 group cursor-pointer">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white group-hover:bg-[#1ed760] transition-colors rounded-full"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-400 w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Spotify/Apple Music Style Lyrics & Queue */}
        <div className="relative bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 flex flex-col h-[540px] md:h-[580px] max-w-xl mx-auto w-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Toast Notification when user jumps to lyric */}
          {toastMessage && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 px-3.5 py-1.5 bg-[#1ed760] text-black font-extrabold text-xs rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. LYRICS TAB */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Lyrics Header with Interactive Info */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#1ed760]/20 text-[#1ed760]">
                    <Mic2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Live Lyrics</h3>
                    <p className="text-[11px] text-zinc-400">Click any line to play from there</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-300 font-medium">
                  <Sparkles className="w-3 h-3 text-[#1ed760]" />
                  <span>Synced</span>
                </div>
              </div>

              {/* Lyrics List Container */}
              <div
                ref={lyricsContainerRef}
                onScroll={handleLyricsScroll}
                className="flex-1 overflow-y-auto space-y-4 pr-3 pt-2 pb-16 scroll-smooth scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
              >
                {lyricsLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[#1ed760]" />
                    <span className="text-sm font-semibold">Loading lyrics...</span>
                  </div>
                ) : parsedLyrics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2 text-center p-6">
                    <Mic2 className="w-10 h-10 text-zinc-600 mb-1" />
                    <p className="text-base font-bold text-white">Lyrics not available</p>
                    <p className="text-xs text-zinc-400 max-w-xs">
                      We couldn't find official lyrics for this song yet. Enjoy the music!
                    </p>
                  </div>
                ) : (
                  parsedLyrics.map((line, idx) => {
                    const isActive = idx === activeLineIndex;
                    const isFlashed = flashLineId === line.id;

                    return (
                      <div
                        key={line.id}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => handleLyricClick(line)}
                        className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-200 select-none ${
                          isActive
                            ? 'bg-white/10 text-white font-black scale-[1.02] shadow-sm'
                            : 'text-white/40 hover:text-white/90 hover:bg-white/5'
                        } ${isFlashed ? 'ring-2 ring-[#1ed760] bg-[#1ed760]/20' : ''}`}
                      >
                        {/* Lyric Text with Visualizer on Active Line */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isActive && (
                            <span className="flex items-end gap-0.5 h-4 w-3 shrink-0 mr-1">
                              <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                              <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                              <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-5/6" style={{ animationDelay: '300ms' }} />
                            </span>
                          )}

                          <span
                            className={`tracking-tight transition-all duration-200 ${
                              isActive
                                ? 'text-xl md:text-2xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                                : 'text-base md:text-lg font-bold'
                            }`}
                          >
                            {line.text}
                          </span>
                        </div>

                        {/* Hover Jump Pill with Play Icon and Time */}
                        <div
                          className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold transition-all ${
                            isActive
                              ? 'text-[#1ed760] bg-[#1ed760]/10'
                              : 'opacity-0 group-hover:opacity-100 bg-white/10 text-zinc-300'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{line.formattedTime}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Floating "Jump to current singing lyric" pill when user scrolled away */}
              {isUserScrolling && activeLineIndex !== -1 && (
                <button
                  onClick={scrollToActiveLine}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-extrabold text-xs rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  <ArrowDown className="w-4 h-4" />
                  <span>Sync to current lyric</span>
                </button>
              )}
            </div>
          )}

          {/* 2. QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#1ed760]/20 text-[#1ed760]">
                    <ListMusic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Up Next</h3>
                    <p className="text-[11px] text-zinc-400">{queue.length} songs in queue</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {queue.map((track, idx) => {
                  const isCurrent = idx === queueIndex;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => playPlaylist(queue, idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 group ${
                        isCurrent
                          ? 'bg-white/10 text-[#1ed760] font-bold border border-[#1ed760]/20'
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          {isCurrent && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="flex items-end gap-0.5 h-3.5 w-3">
                                <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                                <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-5/6" style={{ animationDelay: '300ms' }} />
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="truncate min-w-0">
                          <div className={`text-sm truncate ${isCurrent ? 'text-[#1ed760] font-bold' : 'text-white font-medium'}`}>
                            {track.title}
                          </div>
                          <div className="text-xs text-zinc-400 truncate mt-0.5">
                            {track.artist || 'Unknown Artist'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 group-hover:text-white shrink-0 ml-3">
                        {track.durationFormatted || '3:30'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
