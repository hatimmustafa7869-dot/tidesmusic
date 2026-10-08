import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { RepeatMode, Track } from '../types';
import { useLibrary } from './LibraryContext';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Track[];
  queueIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  playPlaylist: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  addTracksToQueue: (tracks: Track[]) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  syncRemotePlayback: (track: Track, isPlaying: boolean, currentTime: number, newQueue?: Track[]) => void;
  registerPlaybackEventListener: (listener: ((event: any) => void) | null) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToHistory } = useLibrary();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('soundflow_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);

    const handleTimeUpdate = () => {
      if (audio) {
        setCurrentTime(audio.currentTime);
        if ('mediaSession' in navigator && !isNaN(audio.duration) && audio.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.min(audio.currentTime, audio.duration),
            });
          } catch {
            // Ignore position state errors on unsupported platforms
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (audio) {
        setDuration(audio.duration || 0);
      }
    };

    const handleError = (e: any) => {
      console.warn('Audio playback error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Update volume & muted on audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle Track Completion
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;
      }
      nextTrack();
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [queue, queueIndex, repeat, shuffle]);

  // Synchronize MediaSession API for Native Lockscreen and Background Controls
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist || 'Unknown Artist',
      album: 'Tides Music',
      artwork: [
        { src: currentTrack.thumbnail, sizes: '96x96', type: 'image/jpeg' },
        { src: currentTrack.thumbnail, sizes: '128x128', type: 'image/jpeg' },
        { src: currentTrack.thumbnail, sizes: '192x192', type: 'image/jpeg' },
        { src: currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
        { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      if (audioRef.current) audioRef.current.play().catch(console.error);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioRef.current) audioRef.current.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 10));
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 9999,
          audioRef.current.currentTime + (details.seekOffset || 10)
        );
      }
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    });
  }, [currentTrack]);

  // Load and play a specific track
  const loadAndPlayTrack = (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    addToHistory(track);

    const streamUrl = api.getStreamUrl(track.id);
    audio.src = streamUrl;
    audio.load();
    audio.play().catch(err => {
      console.warn('Playback initiation error:', err);
    });
  };

  const isSyncingFromRemoteRef = useRef(false);
  const playbackEventListenerRef = useRef<((event: any) => void) | null>(null);

  const registerPlaybackEventListener = (listener: ((event: any) => void) | null) => {
    playbackEventListenerRef.current = listener;
  };

  const syncRemotePlayback = (track: Track, shouldPlay: boolean, time: number, newQueue?: Track[]) => {
    isSyncingFromRemoteRef.current = true;
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    }
    const audio = audioRef.current;
    if (!audio) {
      isSyncingFromRemoteRef.current = false;
      return;
    }

    if (!currentTrack || currentTrack.id !== track.id) {
      setCurrentTrack(track);
      setIsLoading(true);
      setCurrentTime(time);
      setDuration(track.duration || 0);
      audio.src = api.getStreamUrl(track.id);
      audio.currentTime = time;
      if (shouldPlay) {
        audio.play().catch(console.warn);
      } else {
        audio.pause();
      }
    } else {
      if (Math.abs(audio.currentTime - time) > 2) {
        audio.currentTime = time;
        setCurrentTime(time);
      }
      if (shouldPlay && audio.paused) {
        audio.play().catch(console.warn);
      } else if (!shouldPlay && !audio.paused) {
        audio.pause();
      }
    }
    setTimeout(() => {
      isSyncingFromRemoteRef.current = false;
    }, 400);
  };

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      // Check if track is already in queue
      const existingIdx = queue.findIndex(t => t.id === track.id);
      if (existingIdx !== -1) {
        setQueueIndex(existingIdx);
      } else {
        const nextQ = [track, ...queue];
        setQueue(nextQ);
        setQueueIndex(0);
      }
    }
    loadAndPlayTrack(track);
    if (!isSyncingFromRemoteRef.current) {
      playbackEventListenerRef.current?.({ type: 'PLAY_TRACK', track, queue: newQueue || queue });
    }
  };

  const playPlaylist = (tracks: Track[], startIndex: number = 0) => {
    if (!tracks || tracks.length === 0) return;
    setQueue(tracks);
    const validIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
    setQueueIndex(validIndex);
    loadAndPlayTrack(tracks[validIndex]);
    if (!isSyncingFromRemoteRef.current) {
      playbackEventListenerRef.current?.({ type: 'PLAY_TRACK', track: tracks[validIndex], queue: tracks, queue_index: validIndex });
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
    if (!isSyncingFromRemoteRef.current) {
      playbackEventListenerRef.current?.({ type: 'TOGGLE_PLAY', is_playing: !isPlaying, current_time: currentTime });
    }
  };

  const nextTrack = async () => {
    if (queue.length === 0) return;

    if (shuffle && queue.length > 1) {
      let randIdx = Math.floor(Math.random() * queue.length);
      while (randIdx === queueIndex && queue.length > 1) {
        randIdx = Math.floor(Math.random() * queue.length);
      }
      setQueueIndex(randIdx);
      loadAndPlayTrack(queue[randIdx]);
      return;
    }

    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      setQueueIndex(nextIdx);
      loadAndPlayTrack(queue[nextIdx]);
    } else {
      if (repeat === 'all') {
        setQueueIndex(0);
        loadAndPlayTrack(queue[0]);
      } else if (currentTrack) {
        // Auto-fetch related "Up Next" tracks so music keeps playing smoothly
        setIsLoading(true);
        try {
          const upNext = await api.getUpNext(currentTrack.id);
          if (upNext.length > 0) {
            setQueue(prev => [...prev, ...upNext]);
            setQueueIndex(nextIdx);
            loadAndPlayTrack(upNext[0]);
          } else {
            setIsLoading(false);
          }
        } catch {
          setIsLoading(false);
        }
      }
    }
  };

  const prevTrack = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (queue.length === 0) return;

    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      setQueueIndex(prevIdx);
      loadAndPlayTrack(queue[prevIdx]);
    } else {
      setQueueIndex(0);
      if (queue[0]) loadAndPlayTrack(queue[0]);
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (audio) {
      try {
        if (!isNaN(seconds) && isFinite(seconds)) {
          audio.currentTime = seconds;
        }
      } catch (e) {
        console.warn('Seek error:', e);
      }
      setCurrentTime(seconds);
      if (!isSyncingFromRemoteRef.current) {
        playbackEventListenerRef.current?.({ type: 'SEEK', current_time: seconds });
      }
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0) setIsMuted(false);
    localStorage.setItem('soundflow_volume', clamped.toString());
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const toggleShuffle = () => {
    setShuffle(prev => !prev);
  };

  const toggleRepeat = () => {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
    if (queue.length === 0) {
      setQueueIndex(0);
      loadAndPlayTrack(track);
    }
  };

  const addTracksToQueue = (newTracks: Track[]) => {
    if (!newTracks || newTracks.length === 0) return;
    setQueue(prev => [...prev, ...newTracks]);
    if (queue.length === 0 && newTracks.length > 0) {
      setQueueIndex(0);
      loadAndPlayTrack(newTracks[0]);
    }
  };

  const playNextInQueue = (track: Track) => {
    if (queue.length === 0) {
      addToQueue(track);
      return;
    }
    const insertIdx = queueIndex + 1;
    const newQ = [...queue.slice(0, insertIdx), track, ...queue.slice(insertIdx)];
    setQueue(newQ);
  };

  const removeFromQueue = (index: number) => {
    if (index === queueIndex) {
      nextTrack();
    }
    setQueue(prev => prev.filter((_, idx) => idx !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => prev - 1);
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(-1);
    }
  };

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        volume,
        isMuted,
        queue,
        queueIndex,
        shuffle,
        repeat,
        playTrack,
        playPlaylist,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        addTracksToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        syncRemotePlayback,
        registerPlaybackEventListener
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
