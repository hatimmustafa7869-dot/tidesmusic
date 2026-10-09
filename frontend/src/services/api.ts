import type { Playlist, Shelf, Track, User } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('soundflow_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth API
  async register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async login(identifier: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid username/email or password');
    }
    return res.json();
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; devCode?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({ detail: 'Failed to send reset code' }));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to send reset code');
    }
    return data;
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json().catch(() => ({ detail: 'Failed to reset password' }));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to reset password');
    }
    return data;
  },

  // User Cloud Playlists API
  async getUserPlaylists(): Promise<Playlist[]> {
    const res = await fetch(`${API_BASE}/user/playlists`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.playlists || [];
  },

  async createUserPlaylist(
    title: string,
    description: string = '',
    thumbnail: string = '',
    id?: string,
    tracks?: Track[]
  ): Promise<Playlist> {
    const res = await fetch(`${API_BASE}/user/playlists`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, thumbnail, id, tracks })
    });
    if (!res.ok) throw new Error('Failed to create playlist');
    const data = await res.json();
    return data.playlist;
  },

  async updateUserPlaylist(playlistId: string, title: string, description?: string, thumbnail?: string): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, thumbnail })
    });
  },

  async deleteUserPlaylist(playlistId: string): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  },

  async addTrackToPlaylist(playlistId: string, track: Track): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(track)
    });
  },

  async addBatchTracksToPlaylist(playlistId: string, tracks: Track[]): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}/batch-tracks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tracks })
    });
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  },

  async syncFullLibrary(
    localPlaylists: Playlist[],
    localFavorites: Track[],
    localHistory: Track[]
  ): Promise<{ playlists: Playlist[]; favorites: Track[]; history: Track[] }> {
    const res = await fetch(`${API_BASE}/user/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ localPlaylists, localFavorites, localHistory })
    });
    if (!res.ok) throw new Error('Failed to sync library');
    return res.json();
  },

  // User Cloud Favorites API
  async getUserFavorites(): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/user/favorites`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.favorites || [];
  },

  async toggleUserFavorite(track: Track): Promise<boolean> {
    const res = await fetch(`${API_BASE}/user/favorites`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(track)
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.favorited;
  },

  // User Cloud History API
  async getUserHistory(): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/user/history`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  },

  async recordHistory(track: Track): Promise<void> {
    try {
      await fetch(`${API_BASE}/user/history`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(track)
      });
    } catch {
      // Ignore background analytics errors
    }
  },

  async clearUserHistory(): Promise<void> {
    await fetch(`${API_BASE}/user/history`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  },

  // Music & Streaming API
  async search(query: string, type: 'all' | 'songs' | 'playlists' = 'all', pageToken?: string): Promise<{ results: (Track | any)[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ q: query, type });
    if (pageToken) params.append('pageToken', pageToken);
    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getHome(): Promise<{ shelves: Shelf[]; trending: Track[] }> {
    const res = await fetch(`${API_BASE}/home`);
    if (!res.ok) throw new Error('Failed to load home feed');
    return res.json();
  },

  async getPlaylist(playlistId: string): Promise<{ info: any; tracks: Track[] }> {
    const res = await fetch(`${API_BASE}/playlist/${encodeURIComponent(playlistId)}`);
    if (!res.ok) throw new Error('Failed to load playlist');
    return res.json();
  },

  async getUpNext(videoId: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/upnext/${encodeURIComponent(videoId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tracks || [];
    } catch {
      return [];
    }
  },

  async getLyrics(videoId: string): Promise<{ available: boolean; lyrics: string; source?: string }> {
    try {
      const res = await fetch(`${API_BASE}/lyrics/${encodeURIComponent(videoId)}`);
      if (!res.ok) return { available: false, lyrics: 'Lyrics unavailable' };
      return res.json();
    } catch {
      return { available: false, lyrics: 'Failed to load lyrics' };
    }
  },

  getStreamUrl(videoId: string): string {
    return `${API_BASE}/stream/${videoId}`;
  },

  parsePlaylistIdFromUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Spotify playlist or album URL / URI (including intl-xx prefixes and albums)
    const spotifyMatch = trimmed.match(/(?:spotify\.com(?:\/[a-zA-Z]{2}(?:-[a-zA-Z]{2})?)?|spotify:)(?:\/embed)?\/(?:playlist|album)\/([a-zA-Z0-9]{15,35})/i) ||
                         trimmed.match(/spotify:(?:playlist|album):([a-zA-Z0-9]{15,35})/i) ||
                         trimmed.match(/^spotify:([a-zA-Z0-9]{15,35})$/i);
    if (spotifyMatch) {
      return `spotify:${spotifyMatch[1]}`;
    }

    // 2. HTTP URL parsing
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        if (url.hostname.includes('spotify.com')) {
          const parts = url.pathname.split('/').filter(Boolean);
          const plIdx = parts.findIndex(p => p === 'playlist' || p === 'album');
          if (plIdx !== -1 && parts[plIdx + 1]) {
            const rawId = parts[plIdx + 1].split('?')[0];
            return `spotify:${rawId}`;
          }
        }
        const listParam = url.searchParams.get('list');
        if (listParam) return listParam;
      }
    } catch {}

    const ytListMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (ytListMatch) return ytListMatch[1];

    // 3. Raw Spotify ID (22 chars alphanumeric)
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
      return `spotify:${trimmed}`;
    }

    // 4. Raw YouTube playlist ID
    if (!trimmed.includes('/') && !trimmed.includes('?') && !trimmed.includes(' ') && trimmed.length >= 6) {
      return trimmed;
    }

    return null;
  }
};
