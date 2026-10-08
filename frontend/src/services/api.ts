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

  // User Cloud Playlists API
  async getUserPlaylists(): Promise<Playlist[]> {
    const res = await fetch(`${API_BASE}/user/playlists`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.playlists || [];
  },

  async createUserPlaylist(title: string, description: string = '', thumbnail: string = '', id?: string): Promise<Playlist> {
    const res = await fetch(`${API_BASE}/user/playlists`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, thumbnail, id })
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

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await fetch(`${API_BASE}/user/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
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

    // 1. Spotify playlist URL or URI
    // e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
    // e.g. spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
    const spotifyMatch = trimmed.match(/spotify(?:\.com)?\/(?:embed\/)?playlist\/([a-zA-Z0-9]{15,30})/) ||
                         trimmed.match(/spotify:playlist:([a-zA-Z0-9]{15,30})/) ||
                         trimmed.match(/^spotify:([a-zA-Z0-9]{15,30})$/);
    if (spotifyMatch) {
      return `spotify:${spotifyMatch[1]}`;
    }

    // 2. YouTube / YouTube Music playlist URL
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const listParam = url.searchParams.get('list');
        if (listParam) return listParam;

        // In case Spotify URL had unusual formatting
        if (url.hostname.includes('spotify.com')) {
          const parts = url.pathname.split('/').filter(Boolean);
          const plIdx = parts.indexOf('playlist');
          if (plIdx !== -1 && parts[plIdx + 1]) {
            return `spotify:${parts[plIdx + 1]}`;
          }
        }
      }
    } catch {
      // fallback to regex
    }

    const ytListMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (ytListMatch) return ytListMatch[1];

    // 3. Raw Spotify ID (22 chars alphanumeric)
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
      return `spotify:${trimmed}`;
    }

    // 4. Raw playlist ID or list without spaces/slashes
    if (!trimmed.includes('/') && !trimmed.includes('?') && !trimmed.includes(' ') && trimmed.length >= 6) {
      return trimmed;
    }

    return null;
  }
};
