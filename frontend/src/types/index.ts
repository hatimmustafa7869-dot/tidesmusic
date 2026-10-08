export interface User {
  id: string;
  username: string;
  email: string;
  created_at?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: number;
  durationFormatted?: string;
  type?: 'song' | 'video';
  views?: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  itemCount?: number;
  isLocal?: boolean;
}

export interface Playlist extends PlaylistInfo {
  tracks: Track[];
}

export interface Shelf {
  title: string;
  items: (Track | {
    id: string;
    title: string;
    artist?: string;
    thumbnail: string;
    type: 'playlist';
  })[];
}

export type RepeatMode = 'off' | 'all' | 'one';
