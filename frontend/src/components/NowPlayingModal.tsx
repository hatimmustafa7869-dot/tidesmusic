import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ChevronDown,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Radio,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useJam } from '../context/JamContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';
import type { Track } from '../types';

interface NowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'player' | 'lyrics' | 'queue';
  onAddToPlaylist?: (track: Track) => void;
}

interface ParsedLyricLine {
  id: number;
  text: string;
  time: number;
  formattedTime: string;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'player',
  onAddToPlaylist
}) => {
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
  const { isJamActive, participants, setIsJamModalOpen } = useJam();

  // Mobile mode: 'player' (default), 'lyrics', or 'queue'
  const [mobileTab, setMobileTab] = useState<'player' | 'lyrics' | 'queue'>(initialTab);
  // Desktop mode: 'lyrics' or 'queue'
  const [desktopTab, setDesktopTab] = useState<'lyrics' | 'queue'>(
    initialTab === 'queue' ? 'queue' : 'lyrics'
  );

  const [rawLyrics, setRawLyrics] = useState<string>('');
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false);
  const [isScrubberHovered, setIsScrubberHovered] = useState<boolean>(false);
  const [scrubberHoverTime, setScrubberHoverTime] = useState<number | null>(null);

  // User scrolling & seek feedback
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [flashLineId, setFlashLineId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollTimeoutRef = useRef<any>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Synchronize initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setMobileTab(initialTab);
      setDesktopTab(initialTab === 'queue' ? 'queue' : 'lyrics');
    }
  }, [isOpen, initialTab]);

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
    const count = rawLines.length;
    const songDur = duration || 210;
    const segment = (songDur * 0.9) / Math.max(1, count);

    return rawLines.map((text, idx) => {
      const time = idx * segment;
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return {
        id: idx,
        text,
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
    const isShowingLyrics = desktopTab === 'lyrics' || mobileTab === 'lyrics';
    if (isUserScrolling || activeLineIndex === -1 || !isShowingLyrics) return;

    const container = lyricsContainerRef.current;
    const activeEl = activeLineRef.current;
    if (container && activeEl) {
      const lineOffsetTop = activeEl.offsetTop;
      const containerHeight = container.clientHeight;
      const targetScrollTop = lineOffsetTop - containerHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [activeLineIndex, isUserScrolling, desktopTab, mobileTab]);

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
    const container = lyricsContainerRef.current;
    const activeEl = activeLineRef.current;
    if (container && activeEl) {
      const lineOffsetTop = activeEl.offsetTop;
      const containerHeight = container.clientHeight;
      const targetScrollTop = lineOffsetTop - containerHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
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

  const displayTime = currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleScrubberSeek = (val: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, val));
    seek(clamped);
  };

  // Reusable controls & track info block
  const renderControls = () => (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-5 sm:space-y-6">
      {/* Cover Art with Vinyl Glow Effect */}
      <div className="relative group">
        {/* Spinning Vinyl Record Peek when Playing */}
        <div
          className={`absolute -right-6 top-3 w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 border-4 border-zinc-800 shadow-2xl transition-all duration-700 pointer-events-none flex items-center justify-center ${
            isPlaying ? 'opacity-90 translate-x-8 md:translate-x-12' : 'opacity-0 translate-x-0'
          }`}
          style={{
            animation: isPlaying ? 'spin 10s linear infinite' : 'none'
          }}
        >
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-zinc-700 bg-[#121212] flex items-center justify-center">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#1ed760]/80 shadow-inner" />
          </div>
        </div>

        {/* Front Album Card */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-zinc-900 border border-white/10 group-hover:scale-[1.02] transition-transform duration-300">
          <img
            src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80'}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Track Details & Favorite Button */}
      <div className="w-full flex items-center justify-between pt-1">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-xl md:text-2xl font-black text-white truncate tracking-tight hover:text-[#1ed760] transition-colors cursor-default">
            {currentTrack.title}
          </h2>
          <p className="text-sm md:text-base text-zinc-400 truncate mt-0.5 font-medium">
            {currentTrack.artist || 'Unknown Artist'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleFavorite(currentTrack)}
            className={`p-2.5 rounded-full hover:bg-white/10 transition-all transform active:scale-125 ${
              isFav ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
            }`}
            title={isFav ? 'Remove from favorites' : 'Save to favorites'}
          >
            <Heart className={`w-6 h-6 md:w-7 md:h-7 ${isFav ? 'fill-current drop-shadow-[0_0_12px_rgba(30,215,96,0.6)]' : ''}`} />
          </button>

          {onAddToPlaylist && (
            <button
              onClick={() => onAddToPlaylist(currentTrack)}
              className="p-2.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all transform active:scale-95"
              title="Add to Playlist"
            >
              <ListPlus className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Progress Tracking Scrubber */}
      <div className="w-full space-y-1.5">
        <div
          className="relative w-full py-2.5 flex items-center cursor-pointer group select-none touch-none"
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
          {/* Tooltip on Hover */}
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
          <div className="w-full h-1.5 group-hover:h-2 bg-white/15 rounded-full overflow-hidden transition-all duration-150 relative">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                isScrubberHovered
                  ? 'bg-gradient-to-r from-emerald-500 to-[#1ed760] shadow-[0_0_10px_rgba(30,215,96,0.7)]'
                  : 'bg-white'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timestamp Numbers */}
        <div className="flex justify-between text-xs font-mono text-zinc-400 font-semibold px-0.5">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Playback Control Bar */}
      <div className="flex items-center justify-between w-full pt-1 px-1">
        <button
          onClick={toggleShuffle}
          className={`p-2.5 rounded-full transition-all relative ${
            shuffle ? 'text-[#1ed760] bg-white/5' : 'text-zinc-400 hover:text-white'
          }`}
          title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
        >
          <Shuffle className="w-5 h-5" />
          {shuffle && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />}
        </button>

        <button
          onClick={() => seek(Math.max(0, currentTime - 10))}
          className="p-2 text-zinc-400 hover:text-white transition flex flex-col items-center group"
          title="Rewind 10 seconds"
        >
          <RotateCcw className="w-5 h-5 group-hover:scale-110 transition" />
          <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white">10s</span>
        </button>

        <button
          onClick={prevTrack}
          className="p-2.5 text-white hover:text-[#1ed760] transition-colors active:scale-90"
          title="Previous Track"
        >
          <SkipBack className="w-6 h-6 fill-current" />
        </button>

        {/* Big Circular Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-[#1ed760] text-black hover:scale-108 active:scale-95 transition-all shadow-[0_0_30px_rgba(30,215,96,0.45)] group"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className="w-7 h-7 animate-spin text-black" />
          ) : isPlaying ? (
            <Pause className="w-7 h-7 fill-current text-black" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-0.5 text-black" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="p-2.5 text-white hover:text-[#1ed760] transition-colors active:scale-90"
          title="Next Track"
        >
          <SkipForward className="w-6 h-6 fill-current" />
        </button>

        <button
          onClick={() => seek(Math.min(duration, currentTime + 10))}
          className="p-2 text-zinc-400 hover:text-white transition flex flex-col items-center group"
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

      {/* Desktop Volume Slider */}
      <div className="hidden sm:flex items-center gap-3 w-64 pt-1">
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

      {/* Mobile-only "Open Live Lyrics" Action Button */}
      <div className="lg:hidden w-full pt-1">
        <button
          onClick={() => setMobileTab('lyrics')}
          className="w-full py-3 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] backdrop-blur-xl flex items-center justify-center gap-2.5 text-sm font-bold text-white transition-all shadow-md active:scale-98"
        >
          <Mic2 className="w-4 h-4 text-[#1ed760]" />
          <span>View Live Lyrics & Sing Along</span>
        </button>
      </div>
    </div>
  );

  // Reusable lyrics list
  const renderLyricsContent = () => (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Toast Notification when user jumps to lyric */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-30 px-3.5 py-1.5 bg-[#1ed760] text-black font-extrabold text-xs rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Lyrics Header */}
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
        className="flex-1 overflow-y-auto space-y-4 pr-2 pt-2 pb-16 scroll-smooth no-scrollbar"
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
                {/* Lyric Text */}
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

                {/* Hover Jump Pill */}
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

      {/* Floating "Sync to current lyric" pill */}
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
  );

  // Reusable queue list
  const renderQueueContent = () => (
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

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
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
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] flex flex-col h-full w-full animate-in fade-in duration-200 overflow-hidden select-none">
      {/* 1. Dynamic Breathing Ambient Aura */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none blur-[120px] scale-125 transition-all duration-1000 ease-out"
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

      {/* 2. Top Header Bar (Rock-Solid Fixed at Top, NEVER Moves or Gets Stuck on Scroll) */}
      <header className="shrink-0 sticky top-0 z-50 flex items-center justify-between px-3 sm:px-6 pt-[max(env(safe-area-inset-top),16px)] pb-3 border-b border-white/[0.08] backdrop-blur-3xl bg-[#080b12]/95 shadow-md">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition px-3 py-1.5 rounded-full hover:bg-white/10 active:scale-95 group shadow-sm shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-white group-hover:translate-y-0.5 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-wider">Close</span>
        </button>

        {/* Brand Status Indicator (Visible on desktop) */}
        <div className="hidden lg:flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#1ed760] animate-ping' : 'bg-zinc-500'}`} />
          <span className="text-xs uppercase tracking-widest text-zinc-300 font-extrabold flex items-center gap-1.5">
            Playing on <span className="text-[#1ed760] font-black">Tides Music</span>
          </span>
        </div>

        {/* Tab Switcher & Jam Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Tab Switcher (< lg) */}
          <div className="flex lg:hidden items-center gap-1 bg-black/60 p-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => setMobileTab('player')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                mobileTab === 'player'
                  ? 'bg-[#1ed760] text-black shadow-[0_0_12px_rgba(30,215,96,0.35)] font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setMobileTab('lyrics')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                mobileTab === 'lyrics'
                  ? 'bg-[#1ed760] text-black shadow-[0_0_12px_rgba(30,215,96,0.35)] font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mic2 className="w-3 h-3" />
              <span>Lyrics</span>
            </button>
            <button
              onClick={() => setMobileTab('queue')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                mobileTab === 'queue'
                  ? 'bg-[#1ed760] text-black shadow-[0_0_12px_rgba(30,215,96,0.35)] font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3 h-3" />
              <span>Queue ({queue.length})</span>
            </button>
          </div>

          {/* Desktop Tab Switcher (>= lg) */}
          <div className="hidden lg:flex items-center gap-1 bg-black/60 p-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => setDesktopTab('lyrics')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                desktopTab === 'lyrics'
                  ? 'bg-[#1ed760] text-black shadow-[0_0_15px_rgba(30,215,96,0.35)] font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>
            <button
              onClick={() => setDesktopTab('queue')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                desktopTab === 'queue'
                  ? 'bg-[#1ed760] text-black shadow-[0_0_15px_rgba(30,215,96,0.35)] font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({queue.length})</span>
            </button>
          </div>

          {/* Collaborative Jam Session Button */}
          <button
            onClick={() => setIsJamModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold transition ${
              isJamActive
                ? 'bg-[#1ed760] text-black shadow-[0_0_12px_rgba(30,215,96,0.5)]'
                : 'bg-black/60 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
            title={isJamActive ? `In Jam (${participants.length} listeners)` : 'Start or Join a Jam'}
          >
            <Radio className="w-3.5 h-3.5 text-[#1ed760]" />
            <span className="hidden sm:inline">{isJamActive ? `Jam (${participants.length})` : 'Jam'}</span>
          </button>
        </div>
      </header>

      {/* 3. Main Content View */}
      {/* 3A. Mobile View (< lg) */}
      <div className="lg:hidden flex-1 min-h-0 flex flex-col relative z-10 overflow-hidden">
        {mobileTab === 'player' && (
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col justify-center">
            {renderControls()}
          </div>
        )}

        {mobileTab === 'lyrics' && (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <div className="flex-1 min-h-0">
              {renderLyricsContent()}
            </div>

            {/* Mobile Bottom Mini Player Dock while reading lyrics */}
            <div className="shrink-0 mt-2 px-3.5 py-2.5 rounded-2xl bg-[#0e1320]/90 backdrop-blur-3xl border border-white/[0.12] shadow-2xl flex items-center justify-between gap-3">
              <div
                onClick={() => setMobileTab('player')}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              >
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-10 h-10 rounded-xl object-cover shadow shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                  <div className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={prevTrack}
                  className="p-1.5 text-zinc-400 hover:text-white transition"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full bg-[#1ed760] text-black hover:scale-105 active:scale-95 transition shadow-[0_0_12px_rgba(30,215,96,0.4)]"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-1.5 text-zinc-400 hover:text-white transition"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
                {onAddToPlaylist && (
                  <button
                    onClick={() => onAddToPlaylist(currentTrack)}
                    className="p-1.5 text-zinc-400 hover:text-white transition active:scale-95"
                    title="Add to Playlist"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {mobileTab === 'queue' && (
          <div className="flex-1 min-h-0 p-4">
            {renderQueueContent()}
          </div>
        )}
      </div>

      {/* 3B. Desktop Side-by-Side View (>= lg) */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-10 p-8 max-w-7xl mx-auto w-full flex-1 min-h-0 items-center overflow-hidden relative z-10">
        {/* Left Column: Cover & Controls */}
        <div className="flex flex-col items-center justify-center h-full">
          {renderControls()}
        </div>

        {/* Right Column: Lyrics or Queue Glass Card */}
        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 flex flex-col h-[540px] md:h-[580px] max-w-xl mx-auto w-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
          {desktopTab === 'lyrics' ? renderLyricsContent() : renderQueueContent()}
        </div>
      </div>
    </div>
  );
};
