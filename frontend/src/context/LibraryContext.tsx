import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Playlist, Track } from '../types';
import { useAuth } from './AuthContext';

interface LibraryContextType {
  playlists: Playlist[];
  favorites: Track[];
  history: Track[];
  isLoadingLibrary: boolean;
  createPlaylist: (title: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, newTitle: string) => Promise<void>;
  updatePlaylistDetails: (id: string, title: string, description?: string, thumbnail?: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  addTracksToPlaylist: (playlistId: string, tracks: Track[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  saveRemotePlaylist: (playlistInfo: any, tracks: Track[]) => Promise<Playlist>;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (track: Track) => Promise<void>;
  addToHistory: (track: Track) => void;
  clearHistory: () => Promise<void>;
  syncWithCloud: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const STORAGE_KEY_PLAYLISTS = 'soundflow_playlists_v1';
const STORAGE_KEY_FAVORITES = 'soundflow_favorites_v1';
const STORAGE_KEY_HISTORY = 'soundflow_history_v1';

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FAVORITES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [history, setHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);

  // Sync with Cloud / Hostinger Database when user logs in
  const syncWithCloud = async () => {
    if (!isAuthenticated) return;
    setIsLoadingLibrary(true);
    try {
      const [cloudPlaylists, cloudFavs, cloudHistory] = await Promise.all([
        api.getUserPlaylists(),
        api.getUserFavorites(),
        api.getUserHistory()
      ]);

      setPlaylists(cloudPlaylists);
      setFavorites(cloudFavs);
      setHistory(cloudHistory);
    } catch (err) {
      console.error('Failed to sync library from cloud:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      syncWithCloud();
    }
  }, [isAuthenticated, user?.id]);

  // Persist locally for instant loading on page refresh and offline usage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }, [history]);

  const createPlaylist = async (title: string, description: string = ''): Promise<Playlist> => {
    if (isAuthenticated) {
      const pl = await api.createUserPlaylist(title, description);
      setPlaylists(prev => [pl, ...prev]);
      return pl;
    } else {
      const newPlaylist: Playlist = {
        id: `local-pl-${Date.now()}`,
        title,
        description,
        thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
        itemCount: 0,
        isLocal: true,
        tracks: []
      };
      setPlaylists(prev => [newPlaylist, ...prev]);
      return newPlaylist;
    }
  };

  const deletePlaylist = async (id: string) => {
    if (isAuthenticated) {
      try {
        await api.deleteUserPlaylist(id);
      } catch (err) {
        console.error(err);
      }
    }
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const renamePlaylist = async (id: string, newTitle: string) => {
    if (isAuthenticated) {
      try {
        await api.updateUserPlaylist(id, newTitle);
      } catch (err) {
        console.error(err);
      }
    }
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  const updatePlaylistDetails = async (id: string, title: string, description?: string, thumbnail?: string) => {
    if (isAuthenticated) {
      try {
        await api.updateUserPlaylist(id, title, description);
      } catch (err) {
        console.error(err);
      }
    }
    setPlaylists(prev => prev.map(p => p.id === id ? {
      ...p,
      title,
      description: description !== undefined ? description : p.description,
      thumbnail: thumbnail || p.thumbnail
    } : p));
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track) => {
    if (isAuthenticated) {
      try {
        await api.addTrackToPlaylist(playlistId, track);
      } catch (err) {
        console.error(err);
      }
    }

    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      if (p.tracks.some(t => t.id === track.id)) return p;
      const updatedTracks = [track, ...p.tracks];
      return {
        ...p,
        tracks: updatedTracks,
        itemCount: updatedTracks.length,
        thumbnail: track.thumbnail || p.thumbnail
      };
    }));
  };

  const addTracksToPlaylist = async (playlistId: string, newTracks: Track[]) => {
    if (isAuthenticated) {
      try {
        const chunkSize = 5;
        for (let i = 0; i < newTracks.length; i += chunkSize) {
          const chunk = newTracks.slice(i, i + chunkSize);
          await Promise.all(chunk.map(t => api.addTrackToPlaylist(playlistId, t).catch(console.error)));
        }
      } catch (err) {
        console.error(err);
      }
    }

    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const existingIds = new Set(p.tracks.map(t => t.id));
      const filtered = newTracks.filter(t => !existingIds.has(t.id));
      const combined = [...p.tracks, ...filtered];
      return {
        ...p,
        tracks: combined,
        itemCount: combined.length,
        thumbnail: p.thumbnail || (combined[0] ? combined[0].thumbnail : '')
      };
    }));
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    if (isAuthenticated) {
      try {
        await api.removeTrackFromPlaylist(playlistId, trackId);
      } catch (err) {
        console.error(err);
      }
    }

    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const updatedTracks = p.tracks.filter(t => t.id !== trackId);
      return {
        ...p,
        tracks: updatedTracks,
        itemCount: updatedTracks.length
      };
    }));
  };

  const saveRemotePlaylist = async (playlistInfo: any, tracks: Track[]): Promise<Playlist> => {
    if (isAuthenticated) {
      const pl = await api.createUserPlaylist(
        playlistInfo.title || 'Saved Playlist',
        playlistInfo.description || '',
        playlistInfo.thumbnail || (tracks[0] ? tracks[0].thumbnail : '')
      );
      // Add all tracks in parallel chunks of 5
      const chunkSize = 5;
      for (let i = 0; i < tracks.length; i += chunkSize) {
        const chunk = tracks.slice(i, i + chunkSize);
        await Promise.all(chunk.map(t => api.addTrackToPlaylist(pl.id, t).catch(console.error)));
      }
      pl.tracks = tracks;
      pl.itemCount = tracks.length;
      setPlaylists(prev => [pl, ...prev.filter(p => p.id !== pl.id)]);
      return pl;
    } else {
      const newSaved: Playlist = {
        id: playlistInfo.id || `pl-${Date.now()}`,
        title: playlistInfo.title || 'Saved Playlist',
        description: playlistInfo.description || '',
        author: playlistInfo.author || 'Tides Music',
        thumbnail: playlistInfo.thumbnail || (tracks[0] ? tracks[0].thumbnail : ''),
        itemCount: tracks.length,
        isLocal: false,
        tracks
      };
      setPlaylists(prev => [newSaved, ...prev.filter(p => p.id !== newSaved.id)]);
      return newSaved;
    }
  };

  const isFavorite = (trackId: string): boolean => {
    return favorites.some(t => t.id === trackId);
  };

  const toggleFavorite = async (track: Track) => {
    const exists = favorites.some(t => t.id === track.id);
    if (exists) {
      setFavorites(prev => prev.filter(t => t.id !== track.id));
    } else {
      setFavorites(prev => [track, ...prev]);
    }

    if (isAuthenticated) {
      try {
        await api.toggleUserFavorite(track);
      } catch (err) {
        console.error('Failed to sync favorite:', err);
      }
    }
  };

  const addToHistory = (track: Track) => {
    setHistory(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      return [track, ...filtered].slice(0, 50);
    });

    if (isAuthenticated) {
      api.recordHistory(track).catch(console.error);
    }
  };

  const clearHistory = async () => {
    setHistory([]);
    if (isAuthenticated) {
      try {
        await api.clearUserHistory();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        playlists,
        favorites,
        history,
        isLoadingLibrary,
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        updatePlaylistDetails,
        addTrackToPlaylist,
        addTracksToPlaylist,
        removeTrackFromPlaylist,
        saveRemotePlaylist,
        isFavorite,
        toggleFavorite,
        addToHistory,
        clearHistory,
        syncWithCloud
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
