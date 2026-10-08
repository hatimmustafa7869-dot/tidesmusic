import React, { useEffect, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { TrackCard } from '../components/TrackCard';
import { TrackRow } from '../components/TrackRow';
import { useAudio } from '../context/AudioContext';
import { api } from '../services/api';
import type { Track } from '../types';

interface SearchPageProps {
  initialQuery?: string;
  onSelectPlaylist: (playlistId: string) => void;
  onOpenAddToPlaylist: (track: Track) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery = '',
  onSelectPlaylist,
  onOpenAddToPlaylist
}) => {
  const { playTrack } = useAudio();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<'all' | 'songs' | 'playlists'>('all');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeSearch = async (searchQuery: string, typeFilter: 'all' | 'songs' | 'playlists') => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.search(searchQuery.trim(), typeFilter);
      setResults(data.results || []);
      setLoading(false);
    } catch (err: any) {
      setError('Search failed. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery, filter);
    }
  }, [initialQuery]);

  const handleFilterChange = (newFilter: 'all' | 'songs' | 'playlists') => {
    setFilter(newFilter);
    if (query) {
      executeSearch(query, newFilter);
    }
  };

  const isShortOrStatus = (item: any) => {
    if (item.duration && item.duration > 0 && item.duration < 70) return true;
    const txt = `${item.title || ''} ${item.artist || ''}`.toLowerCase();
    return (
      txt.includes('#short') ||
      txt.includes('#shorts') ||
      txt.includes('whatsapp status') ||
      txt.includes('status video') ||
      txt.includes('30 sec status') ||
      txt.includes('lyrics motion')
    );
  };

  const cleanResults = results.filter(r => !isShortOrStatus(r));
  const songs = cleanResults.filter(r => r.type === 'song');
  const playlists = cleanResults.filter(r => r.type === 'playlist');
  const topResult = songs[0];

  return (
    <div className="space-y-6 pb-28 animate-fade-in-up">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 pb-2">
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
            filter === 'all'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange('songs')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
            filter === 'songs'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Songs
        </button>
        <button
          onClick={() => handleFilterChange('playlists')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
            filter === 'playlists'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Playlists
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-[#b3b3b3]">
          <Loader2 className="w-8 h-8 animate-spin text-[#1ed760]" />
          <p className="text-sm font-semibold">Searching...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !query && (
        <div className="space-y-6 pt-4">
          <h2 className="text-xl md:text-2xl font-black text-white">Browse all</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { name: 'Pop', color: 'from-pink-600 to-rose-700' },
              { name: 'Hip-Hop', color: 'from-amber-600 to-orange-700' },
              { name: 'Rock', color: 'from-red-600 to-rose-800' },
              { name: 'Chill & Lofi', color: 'from-teal-600 to-emerald-800' },
              { name: 'Workout', color: 'from-indigo-600 to-blue-800' },
              { name: 'Party', color: 'from-purple-600 to-violet-800' },
              { name: 'Focus', color: 'from-cyan-600 to-blue-700' },
              { name: 'Mood', color: 'from-emerald-600 to-teal-800' },
            ].map(genre => (
              <div
                key={genre.name}
                onClick={() => {
                  setQuery(genre.name);
                  executeSearch(genre.name, filter);
                }}
                className={`aspect-square p-4 rounded-lg bg-gradient-to-br ${genre.color} cursor-pointer hover:scale-[1.02] transition shadow-lg relative overflow-hidden select-none`}
              >
                <span className="text-lg md:text-xl font-black text-white tracking-tight">
                  {genre.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Result + Songs Section (Spotify Layout) */}
      {!loading && songs.length > 0 && (filter === 'all' || filter === 'songs') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Top Result Card */}
          {topResult && filter === 'all' && (
            <div className="lg:col-span-5 space-y-3">
              <h2 className="text-xl font-black text-white">Top result</h2>
              <div
                onClick={() => playTrack(topResult)}
                className="group relative p-5 rounded-md bg-[#181818] hover:bg-[#282828] cursor-pointer transition select-none flex flex-col justify-between h-[230px]"
              >
                <div className="space-y-4">
                  <div className="w-24 h-24 rounded shadow-2xl overflow-hidden bg-[#242424]">
                    <img
                      src={topResult.thumbnail}
                      alt={topResult.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white truncate">
                      {topResult.title}
                    </h3>
                    <p className="text-xs text-[#b3b3b3] mt-1">
                      <span className="text-white font-semibold">{topResult.artist}</span> &bull;{' '}
                      <span className="px-2 py-0.5 rounded-full bg-black/60 text-white uppercase text-[10px] font-bold">
                        Song
                      </span>
                    </p>
                  </div>
                </div>

                {/* Floating Play Button */}
                <div className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>
          )}

          {/* Right: Songs Table */}
          <div className={filter === 'all' && topResult ? 'lg:col-span-7 space-y-3' : 'col-span-12 space-y-3'}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">Songs</h2>
            </div>
            <div className="space-y-0.5">
              {songs.slice(0, filter === 'all' ? 4 : 20).map((song, idx) => (
                <TrackRow
                  key={song.id}
                  track={song}
                  index={idx}
                  tracksContext={songs}
                  onAddToPlaylist={onOpenAddToPlaylist}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlists Grid */}
      {!loading && playlists.length > 0 && (filter === 'all' || filter === 'playlists') && (
        <section className="space-y-3 pt-6">
          <h2 className="text-xl font-black text-white">Playlists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {playlists.map(pl => (
              <TrackCard
                key={pl.id}
                item={pl}
                onSelectPlaylist={onSelectPlaylist}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
