import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAudio } from './AudioContext';
import { useAuth } from './AuthContext';

export interface JamParticipant {
  id: string;
  name: string;
  is_host: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
}

interface JamContextType {
  jamId: string | null;
  isJamActive: boolean;
  isHost: boolean;
  participants: JamParticipant[];
  reactions: FloatingReaction[];
  createJam: () => Promise<string>;
  joinJam: (codeOrUrl: string) => Promise<boolean>;
  leaveJam: () => void;
  sendReaction: (emoji: string) => void;
  isJamModalOpen: boolean;
  setIsJamModalOpen: (open: boolean) => void;
}

const JamContext = createContext<JamContextType | undefined>(undefined);

export const JamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentTrack, isPlaying, currentTime, queue, syncRemotePlayback, registerPlaybackEventListener } = useAudio();

  const [jamId, setJamId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<JamParticipant[]>([]);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isJamModalOpen, setIsJamModalOpen] = useState<boolean>(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const myIdRef = useRef<string>(user?.id || `user-${Math.random().toString(36).substring(2, 8)}`);
  const myNameRef = useRef<string>(user?.username || 'Guest Listener');

  useEffect(() => {
    if (user?.id) myIdRef.current = user.id;
    if (user?.username) myNameRef.current = user.username;
  }, [user]);

  // Connect to WebSocket when jamId is set
  useEffect(() => {
    if (!jamId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setParticipants([]);
      setIsHost(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/jam/${jamId}?user_id=${encodeURIComponent(myIdRef.current)}&user_name=${encodeURIComponent(myNameRef.current)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Jam WebSocket connected:', jamId);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const { type } = data;

        if (type === 'SYNC_STATE') {
          const { state } = data;
          if (state) {
            setParticipants(state.participants || []);
            setIsHost(state.host_id === myIdRef.current);
            if (state.current_track) {
              syncRemotePlayback(state.current_track, state.is_playing, state.current_time || 0, state.queue);
            }
          }
        } else if (type === 'USER_JOINED') {
          if (data.state) {
            setParticipants(data.state.participants || []);
          }
        } else if (type === 'USER_LEFT') {
          if (data.state) {
            setParticipants(data.state.participants || []);
          }
        } else if (type === 'PLAY_TRACK') {
          if (data.sender_id !== myIdRef.current && data.track) {
            syncRemotePlayback(data.track, true, data.current_time || 0, data.queue);
          }
        } else if (type === 'TOGGLE_PLAY') {
          if (data.sender_id !== myIdRef.current && currentTrack) {
            syncRemotePlayback(currentTrack, data.is_playing, data.current_time || currentTime);
          }
        } else if (type === 'SEEK') {
          if (data.sender_id !== myIdRef.current && currentTrack) {
            syncRemotePlayback(currentTrack, isPlaying, data.current_time || 0);
          }
        } else if (type === 'REACTION') {
          const reactionId = `react-${Date.now()}-${Math.random()}`;
          const newReaction: FloatingReaction = {
            id: reactionId,
            emoji: data.emoji || '❤️',
            userName: data.user_name || 'Listener'
          };
          setReactions(prev => [...prev.slice(-12), newReaction]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== reactionId));
          }, 3500);
        }
      } catch (err) {
        console.warn('Jam message parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Jam WebSocket disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jamId]);

  // Hook into local audio playback events to broadcast them to peers
  useEffect(() => {
    if (!jamId) {
      registerPlaybackEventListener(null);
      return;
    }

    registerPlaybackEventListener((event: any) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (event.type === 'PLAY_TRACK') {
        ws.send(JSON.stringify({
          type: 'PLAY_TRACK',
          track: event.track,
          queue: event.queue,
          start_time: 0
        }));
      } else if (event.type === 'TOGGLE_PLAY') {
        ws.send(JSON.stringify({
          type: 'TOGGLE_PLAY',
          is_playing: event.is_playing,
          current_time: event.current_time
        }));
      } else if (event.type === 'SEEK') {
        ws.send(JSON.stringify({
          type: 'SEEK',
          current_time: event.current_time
        }));
      }
    });

    return () => {
      registerPlaybackEventListener(null);
    };
  }, [jamId]);

  // Check URL on load for ?jam=CODE parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('jam');
    if (code) {
      joinJam(code);
      // Clean query parameter from URL without page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const createJam = async (): Promise<string> => {
    try {
      const res = await fetch('/api/jam/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: myIdRef.current,
          user_name: myNameRef.current
        })
      });
      const data = await res.json();
      const newJamId = data.jam_id;
      setJamId(newJamId);
      setIsHost(true);
      setIsJamModalOpen(true);

      // If already playing a song locally, sync it into the new Jam
      if (currentTrack) {
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'PLAY_TRACK',
              track: currentTrack,
              queue,
              start_time: currentTime
            }));
          }
        }, 500);
      }

      return newJamId;
    } catch (err) {
      console.error('Failed to create jam:', err);
      throw err;
    }
  };

  const joinJam = async (codeOrUrl: string): Promise<boolean> => {
    let code = codeOrUrl.trim().toUpperCase();
    if (code.includes('JAM=')) {
      code = code.split('JAM=')[1].split('&')[0];
    }
    if (!code.startsWith('JAM-') && code.length === 5) {
      code = `JAM-${code}`;
    }

    try {
      const res = await fetch(`/api/jam/${encodeURIComponent(code)}`);
      if (!res.ok) {
        // Even if session is fresh, connect so server creates room
      }
      setJamId(code);
      setIsHost(false);
      setIsJamModalOpen(true);
      return true;
    } catch (err) {
      console.warn('Join jam network error:', err);
      setJamId(code);
      setIsJamModalOpen(true);
      return true;
    }
  };

  const leaveJam = () => {
    setJamId(null);
    setParticipants([]);
    setIsHost(false);
  };

  const sendReaction = (emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REACTION',
        emoji
      }));
    }
  };

  return (
    <JamContext.Provider
      value={{
        jamId,
        isJamActive: jamId !== null,
        isHost,
        participants,
        reactions,
        createJam,
        joinJam,
        leaveJam,
        sendReaction,
        isJamModalOpen,
        setIsJamModalOpen
      }}
    >
      {children}

      {/* Floating Live Reaction Emojis Overlay */}
      {reactions.length > 0 && (
        <div className="fixed bottom-24 right-8 z-50 pointer-events-none flex flex-col items-end gap-2">
          {reactions.map(r => (
            <div
              key={r.id}
              className="animate-in fade-in slide-in-from-bottom-6 duration-300 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-2xl"
            >
              <span className="text-2xl animate-bounce">{r.emoji}</span>
              <span className="text-xs font-bold text-zinc-300">{r.userName}</span>
            </div>
          ))}
        </div>
      )}
    </JamContext.Provider>
  );
};

export const useJam = () => {
  const context = useContext(JamContext);
  if (!context) {
    throw new Error('useJam must be used within a JamProvider');
  }
  return context;
};
