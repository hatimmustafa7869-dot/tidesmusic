import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { RepeatMode, Track } from '../types';
import { useLibrary } from './LibraryContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  unlockAudio: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

function extractCleanVideoId(id: string): string {
  if (!id) return '';
  // Check if it's already an 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
  // If synthetic Spotify ID: sp__title__artist__id or similar
  const parts = id.split('__');
  for (const p of parts) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(p)) return p;
  }
  return id;
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToHistory } = useLibrary();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const activeEngineRef = useRef<'audio' | 'yt'>('audio');
  const useYtEngineRef = useRef<boolean>(false);
  const currentTrackRef = useRef<Track | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const stallTimeoutRef = useRef<any>(null);
  const userExplicitPauseRef = useRef<boolean>(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  const STORAGE_CURRENT_TRACK = 'soundflow_current_track';
  const STORAGE_QUEUE = 'soundflow_queue';
  const STORAGE_QUEUE_INDEX = 'soundflow_queue_index';
  const STORAGE_CURRENT_TIME = 'soundflow_current_time';

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CURRENT_TRACK);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CURRENT_TIME);
      return saved !== null ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [duration, setDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CURRENT_TRACK);
      if (saved) {
        const t = JSON.parse(saved);
        return t.duration || 0;
      }
    } catch {}
    return 0;
  });
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('soundflow_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_QUEUE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [queueIndex, setQueueIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_QUEUE_INDEX);
      return saved !== null ? parseInt(saved, 10) : -1;
    } catch {
      return -1;
    }
  });
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  currentTrackRef.current = currentTrack;
  repeatRef.current = repeat;

  // Initialize YouTube IFrame Player API
  useEffect(() => {
    const initYT = () => {
      if (ytPlayerRef.current || !window.YT || !window.YT.Player) return;
      try {
        ytPlayerRef.current = new window.YT.Player('tides-yt-iframe', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
            modestbranding: 1
          },
          events: {
            onReady: (event: any) => {
              console.log('Tides YouTube Audio Engine initialized');
              event.target.setVolume(isMuted ? 0 : volume * 100);
            },
            onStateChange: (event: any) => {
              if (activeEngineRef.current !== 'yt') return;

              // 1: PLAYING
              if (event.data === 1) {
                userExplicitPauseRef.current = false;
                setIsPlaying(true);
                setIsLoading(false);
                const d = event.target.getDuration();
                if (d > 0) setDuration(d);
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'playing';
                }
              } else if (event.data === 2) {
                // 2: PAUSED
                // If paused involuntarily because tab went into background / screen locked:
                if (document.hidden && !userExplicitPauseRef.current) {
                  setTimeout(() => {
                    if (!userExplicitPauseRef.current && ytPlayerRef.current) {
                      try {
                        ytPlayerRef.current.playVideo();
                      } catch {}
                    }
                  }, 100);
                  return;
                }
                setIsPlaying(false);
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'paused';
                }
              } else if (event.data === 0) {
                // 0: ENDED
                if (repeatRef.current === 'one') {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                } else {
                  nextTrack();
                }
              } else if (event.data === 3) {
                // 3: BUFFERING
                setIsLoading(true);
              }
            },
            onError: (err: any) => {
              console.warn('YouTube Player Error:', err);
              setIsLoading(false);
            }
          }
        });
      } catch (e) {
        console.warn('Init YT Player error:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = initYT;
    }
  }, []);

  // Initialize HTML5 Audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handlePlay = () => {
      if (activeEngineRef.current === 'audio') setIsPlaying(true);
    };
    const handlePause = () => {
      if (activeEngineRef.current === 'audio') setIsPlaying(false);
    };
    const handleWaiting = () => {
      if (activeEngineRef.current === 'audio') setIsLoading(true);
    };
    const handlePlaying = () => {
      if (activeEngineRef.current === 'audio') {
        setIsLoading(false);
        setIsPlaying(true);
        if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      }
    };
    const handleCanPlay = () => {
      if (activeEngineRef.current === 'audio') setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (activeEngineRef.current === 'audio' && audio) {
        setCurrentTime(audio.currentTime);
        if ('mediaSession' in navigator && !isNaN(audio.duration) && audio.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.min(audio.currentTime, audio.duration),
            });
          } catch {}
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (activeEngineRef.current === 'audio' && audio) {
        setDuration(audio.duration || 0);
      }
    };

    const handleError = () => {
      console.warn('Audio stream failed, immediately activating YouTube Audio Engine');
      useYtEngineRef.current = true;
      if (currentTrackRef.current) {
        playWithYouTube(currentTrackRef.current);
      }
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

  // On mount: prepare loaded track from localStorage if present without auto-playing
  useEffect(() => {
    if (currentTrack && audioRef.current && !audioRef.current.src) {
      audioRef.current.src = api.getStreamUrl(currentTrack.id);
      if (currentTime > 0) {
        audioRef.current.currentTime = currentTime;
      }
    }
  }, []);

  // Persist playback state to localStorage for seamless page refreshes
  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem(STORAGE_CURRENT_TRACK, JSON.stringify(currentTrack));
    }
  }, [currentTrack]);

  useEffect(() => {
    if (queue && queue.length > 0) {
      localStorage.setItem(STORAGE_QUEUE, JSON.stringify(queue));
    }
  }, [queue]);

  useEffect(() => {
    if (queueIndex >= 0) {
      localStorage.setItem(STORAGE_QUEUE_INDEX, queueIndex.toString());
    }
  }, [queueIndex]);

  useEffect(() => {
    if (currentTrack && currentTime > 0) {
      localStorage.setItem(STORAGE_CURRENT_TIME, Math.floor(currentTime).toString());
    }
  }, [Math.floor(currentTime / 5)]);

  // Update volume & muted across both engines
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
      if (isMuted) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    }
  }, [volume, isMuted]);

  // Handle Track Completion on HTML5 Audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (activeEngineRef.current !== 'audio') return;
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

  // YouTube Engine Timer Ticker (updates progress slider & lockscreen)
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeEngineRef.current === 'yt' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          const d = ytPlayerRef.current.getDuration();
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTime(t);
            if ('mediaSession' in navigator && typeof d === 'number' && d > 0) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: d,
                  playbackRate: 1,
                  position: Math.min(t, d)
                });
              } catch {}
            }
          }
          if (typeof d === 'number' && d > 0) {
            setDuration(d);
          }
        } catch {}
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Keep background audio active on mobile browsers (prevents mobile Chrome from suspending tab)
  useEffect(() => {
    if (!silentAudioRef.current) {
      // 1-second silent WAV data URI
      const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      audio.loop = true;
      audio.volume = 0.01;
      silentAudioRef.current = audio;
    }

    if (isPlaying) {
      silentAudioRef.current.play().catch(() => {});
    } else {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  // Page visibility change handler to prevent background throttling
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (currentTrackRef.current && isPlaying && !userExplicitPauseRef.current) {
          if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
            try {
              ytPlayerRef.current.playVideo();
            } catch {}
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPlaying]);

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

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => {
      userExplicitPauseRef.current = false;
      if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      navigator.mediaSession.playbackState = 'playing';
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      userExplicitPauseRef.current = true;
      if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      navigator.mediaSession.playbackState = 'paused';
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      seek(Math.max(0, currentTime - (details.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      seek(Math.min(duration || 9999, currentTime + (details.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      userExplicitPauseRef.current = true;
      if (activeEngineRef.current === 'yt' && ytPlayerRef.current) ytPlayerRef.current.pauseVideo();
      else if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      navigator.mediaSession.playbackState = 'paused';
    });
  }, [currentTrack, currentTime, duration, isPlaying]);

  // Synchronize Android Native App Foreground Service Bridge
  useEffect(() => {
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge && currentTrack) {
      try {
        androidBridge.onTrackChange(
          currentTrack.title,
          currentTrack.artist || 'Unknown Artist',
          currentTrack.thumbnail || '',
          isPlaying
        );
      } catch (err) {
        console.warn('AndroidBridge track update error:', err);
      }
    }
  }, [currentTrack, isPlaying]);

  // Expose global controls for Android Native Bridge
  useEffect(() => {
    (window as any).AndroidControls = {
      play: () => {
        userExplicitPauseRef.current = false;
        if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
          ytPlayerRef.current.playVideo();
        } else if (audioRef.current) {
          audioRef.current.play().catch(console.error);
        }
        setIsPlaying(true);
      },
      pause: () => {
        userExplicitPauseRef.current = true;
        if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
          ytPlayerRef.current.pauseVideo();
        } else if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      },
      next: () => nextTrack(),
      prev: () => prevTrack(),
      seek: (sec: number) => seek(sec)
    };

    const handleNativeControl = (e: any) => {
      const action = e.detail?.action;
      if (action === 'play') (window as any).AndroidControls?.play();
      else if (action === 'pause') (window as any).AndroidControls?.pause();
      else if (action === 'next') nextTrack();
      else if (action === 'prev') prevTrack();
    };

    window.addEventListener('nativeMediaControl', handleNativeControl);
    return () => {
      window.removeEventListener('nativeMediaControl', handleNativeControl);
    };
  }, [currentTrack, queue, queueIndex]);

  // Playback execution via YouTube Engine
  const playWithYouTube = (track: Track, startTime: number = 0) => {
    activeEngineRef.current = 'yt';
    useYtEngineRef.current = true;

    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    const cleanId = extractCleanVideoId(track.id);

    const attemptPlay = () => {
      const player = ytPlayerRef.current;
      if (player && typeof player.loadVideoById === 'function') {
        try {
          player.loadVideoById({
            videoId: cleanId,
            startSeconds: startTime
          });
          player.playVideo();
          setIsPlaying(true);
          setIsLoading(false);
          if (track.duration) setDuration(track.duration);
        } catch (e) {
          console.warn('ytPlayer play attempt failed:', e);
        }
      } else {
        setTimeout(attemptPlay, 250);
      }
    };

    attemptPlay();
  };

  // Load and play a specific track
  const loadAndPlayTrack = (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    addToHistory(track);

    // If YouTube engine was already chosen (e.g. Hostinger environment where stream failed), play directly
    if (useYtEngineRef.current) {
      playWithYouTube(track, 0);
      return;
    }

    // Try HTML5 audio stream with automatic 1.8s timeout fallback
    activeEngineRef.current = 'audio';
    const streamUrl = api.getStreamUrl(track.id);
    audio.src = streamUrl;
    audio.load();

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Direct stream rejected, switching to YouTube engine:', err);
        playWithYouTube(track, 0);
      });
    }

    // Safeguard: if audio stays stuck at 0s without playing for 1.8s, trigger YouTube engine
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    stallTimeoutRef.current = setTimeout(() => {
      if (audio.currentTime === 0 && !audio.paused && !isPlaying) {
        console.warn('Audio stuck at 0s, activating YouTube audio engine');
        playWithYouTube(track, 0);
      }
    }, 1800);
  };

  const isSyncingFromRemoteRef = useRef(false);
  const playbackEventListenerRef = useRef<((event: any) => void) | null>(null);

  const registerPlaybackEventListener = (listener: ((event: any) => void) | null) => {
    playbackEventListenerRef.current = listener;
  };

  const unlockAudio = () => {
    try {
      if (silentAudioRef.current) {
        silentAudioRef.current.play().then(() => {
          if (!isPlaying) silentAudioRef.current?.pause();
        }).catch(() => {});
      }
      if (audioRef.current) {
        const dummy = audioRef.current.play();
        if (dummy) {
          dummy.then(() => {
            if (!isPlaying) audioRef.current?.pause();
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Unlock audio failed:', e);
    }
  };

  const syncRemotePlayback = (track: Track, shouldPlay: boolean, time: number, newQueue?: Track[]) => {
    isSyncingFromRemoteRef.current = true;
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    }

    if (!currentTrack || currentTrack.id !== track.id) {
      if (shouldPlay) {
        loadAndPlayTrack(track);
        if (time > 1) {
          setTimeout(() => {
            seek(time);
          }, 600);
        }
      } else {
        setCurrentTrack(track);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentTime(time);
        setDuration(track.duration || 0);
        if (audioRef.current) {
          audioRef.current.src = api.getStreamUrl(track.id);
          audioRef.current.currentTime = time;
          audioRef.current.pause();
        }
      }
    } else {
      // Same track: sync playback state and position
      if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
        const player = ytPlayerRef.current;
        if (Math.abs(currentTime - time) > 2) {
          player.seekTo(time, true);
          setCurrentTime(time);
        }
        if (shouldPlay) {
          player.playVideo();
          setIsPlaying(true);
        } else {
          player.pauseVideo();
          setIsPlaying(false);
        }
      } else {
        const audio = audioRef.current;
        if (audio) {
          if (Math.abs(audio.currentTime - time) > 2) {
            audio.currentTime = time;
            setCurrentTime(time);
          }
          if (shouldPlay && audio.paused) {
            audio.play().catch(err => {
              console.warn('Sync audio play error, trying YT fallback:', err);
              playWithYouTube(track, time);
            });
            setIsPlaying(true);
          } else if (!shouldPlay && !audio.paused) {
            audio.pause();
            setIsPlaying(false);
          }
        }
      }
    }

    setTimeout(() => {
      isSyncingFromRemoteRef.current = false;
    }, 500);
  };

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
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
    if (!currentTrack) return;
    const nextPlay = !isPlaying;
    userExplicitPauseRef.current = isPlaying;

    if (activeEngineRef.current === 'yt' && ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
      setIsPlaying(nextPlay);
    } else if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(console.error);
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = nextPlay ? 'playing' : 'paused';
    }

    if (!isSyncingFromRemoteRef.current) {
      playbackEventListenerRef.current?.({ type: 'TOGGLE_PLAY', is_playing: nextPlay, current_time: currentTime });
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
    if (currentTime > 3) {
      seek(0);
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
    const validSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
    setCurrentTime(validSec);

    if (activeEngineRef.current === 'yt' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(validSec, true);
    } else if (audioRef.current) {
      try {
        audioRef.current.currentTime = validSec;
      } catch (e) {
        console.warn('Seek error:', e);
      }
    }

    if (!isSyncingFromRemoteRef.current) {
      playbackEventListenerRef.current?.({ type: 'SEEK', current_time: validSec });
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
        registerPlaybackEventListener,
        unlockAudio
      }}
    >
      {children}
      {/* Invisible YouTube Audio Engine for guaranteed cross-device playback */}
      <div
        id="tides-hidden-yt-container"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -100
        }}
        aria-hidden="true"
      >
        <div id="tides-yt-iframe" />
      </div>
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
