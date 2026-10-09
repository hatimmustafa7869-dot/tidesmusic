import React, { useEffect, useState } from 'react';
import { Heart, ListMusic, Loader2, Play } from 'lucide-react';
import { TrackCard } from '../components/TrackCard';
import { TrackRow } from '../components/TrackRow';
import { useAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';
import type { Shelf, Track } from '../types';

interface HomePageProps {
  onSelectPlaylist: (playlistId: string) => void;
  onOpenAddToPlaylist: (track: Track) => void;
  onNavigateFavorites: () => void;
}

// Module-level cache so navigating back to Home from playlists or other views is instant
let cachedHomeData: { shelves: Shelf[]; trending: Track[] } | null = null;

export const HomePage: React.FC<HomePageProps> = ({
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onNavigateFavorites
}) => {
  const { playPlaylist, currentTrack, isPlaying } = useAudio();
  const { playlists, favorites } = useLibrary();

  const [activeTab, setActiveTab] = useState<'all' | 'songs' | 'playlists'>('all');
  const [shelves, setShelves] = useState<Shelf[]>(() => cachedHomeData?.shelves || []);
  const [trending, setTrending] = useState<Track[]>(() => cachedHomeData?.trending || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedHomeData);

  useEffect(() => {
    let mounted = true;
    api.getHome()
      .then(data => {
        if (!mounted) return;
        // Filter out shorts from trending songs just in case
        const cleanTrending = (data.trending || []).filter(
          (t: Track) => !t.duration || t.duration >= 70
        );
        cachedHomeData = {
          shelves: data.shelves || [],
          trending: cleanTrending
        };
        setShelves(data.shelves || []);
        setTrending(cleanTrending);
        setLoading(false);
      })
      .catch(err => {
        console.error('Home load error:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#b3b3b3] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1ed760]" />
        <p className="text-sm font-semibold">Loading Tides Music...</p>
      </div>
    );
  }

  // Quick Access Grid: Liked Songs + ONLY the user's added playlists
  const quickCards = [
    {
      id: 'quick-liked',
      title: 'Liked Songs',
      thumbnail: '',
      count: favorites.length,
      isLiked: true,
      onClick: onNavigateFavorites
    },
    ...playlists.slice(0, 5).map(pl => ({
      id: pl.id,
      title: pl.title,
      thumbnail: pl.thumbnail || (pl.tracks && pl.tracks.length > 0 ? pl.tracks[0].thumbnail : ''),
      count: pl.tracks?.length || 0,
      isLiked: false,
      onClick: () => onSelectPlaylist(pl.id)
    }))
  ];

  // Upcoming Releases shelf (filtered full length tracks)
  const upcomingReleases: Track[] = [
    {
      id: 'pre-1',
      title: 'Ustad (Grand Tribute)',
      artist: 'Ustad Rahat & Sufi Masters',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&q=80',
      duration: 245,
      type: 'song'
    },
    {
      id: 'pre-2',
      title: 'NO BATIDÃO',
      artist: 'ZXKAI, slxughter',
      thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80',
      duration: 148,
      type: 'song'
    },
    {
      id: 'pre-3',
      title: 'Into The Deep Forest',
      artist: 'David Viking',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80',
      duration: 210,
      type: 'song'
    },
    {
      id: 'pre-4',
      title: 'Neon Nights & Drift',
      artist: 'Kavinsky & The Midnight',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
      duration: 195,
      type: 'song'
    },
    {
      id: 'pre-5',
      title: 'After Hours Melody',
      artist: 'The Weeknd',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80',
      duration: 230,
      type: 'song'
    },
    {
      id: 'pre-6',
      title: 'Lofi Stargazing',
      artist: 'ChilledCow Collective',
      thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80',
      duration: 160,
      type: 'song'
    }
  ];

  return (
    <div className="space-y-7 pb-24 animate-fade-in select-none">
      {/* Category Pills Bar: All, Songs, Playlists */}
      <div className="flex items-center gap-2 pt-1 pb-3 border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'all'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('songs')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'songs'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          Songs
        </button>
        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'playlists'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          Playlists
        </button>
      </div>

      {/* Quick Access 6-Grid (Always visible in All or Songs) */}
      {(activeTab === 'all' || activeTab === 'songs') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {quickCards.map(item => {
            const isItemPlaying = currentTrack?.id === item.id && isPlaying;
            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className="group relative flex items-center bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.02] hover:from-white/[0.14] hover:via-white/[0.08] hover:to-white/[0.04] border border-white/[0.1] hover:border-white/[0.25] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 select-none pr-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.5)] backdrop-blur-2xl hover:-translate-y-1"
              >
                {/* Top specular hairline */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {item.isLiked ? (
                  <div className="w-16 h-16 bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] flex items-center justify-center shrink-0 shadow-lg">
                    <Heart className="w-7 h-7 text-white fill-current drop-shadow-md" />
                  </div>
                ) : item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-16 object-cover shrink-0 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center shrink-0 shadow-lg">
                    <ListMusic className="w-7 h-7 text-white/90" />
                  </div>
                )}

                <div className="flex-1 px-4 min-w-0">
                  <span className="text-sm font-extrabold text-white truncate block tracking-tight">
                    {item.title}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium block mt-0.5">
                    {item.count} {item.count === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                {/* Floating Spotify Green Play Button */}
                <div
                  className={`w-11 h-11 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(30,215,96,0.4)] transition-all duration-200 transform group-hover:scale-105 shrink-0 ${
                    isItemPlaying ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 1: Today's Biggest Hits (Prominently at the Top) */}
      {(activeTab === 'all' || activeTab === 'songs') && trending.length > 0 && (
        <section className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black text-white hover:underline cursor-pointer tracking-tight">
                Today's Biggest Hits
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 shadow-[0_0_12px_rgba(30,215,96,0.25)]">
                Trending
              </span>
            </div>
            <button
              onClick={() => playPlaylist(trending, 0)}
              className="text-xs font-bold text-zinc-300 hover:text-white px-4 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 backdrop-blur-xl shadow-sm transition"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {trending.slice(0, 6).map(track => (
              <TrackCard key={track.id} item={track} />
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Popular Tracks (Table View with rankings) */}
      {(activeTab === 'all' || activeTab === 'songs') && trending.length > 0 && (
        <section className="space-y-3.5 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-white tracking-tight">Popular Tracks</h2>
              <span className="text-xs text-zinc-400 font-semibold">Ranked by plays</span>
            </div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-2.5 sm:p-3.5 border border-white/[0.1] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
            {trending.slice(0, 8).map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                tracksContext={trending}
                onAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Popular Playlists & Mixes (Playlists / All) */}
      {(activeTab === 'all' || activeTab === 'playlists') &&
        shelves.map((shelf, sIdx) => (
          <section key={sIdx} className="space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-black text-white hover:underline cursor-pointer tracking-tight">
                {shelf.title}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {shelf.items.map(item => (
                <TrackCard
                  key={item.id}
                  item={item}
                  onSelectPlaylist={onSelectPlaylist}
                />
              ))}
            </div>
          </section>
        ))}

      {/* Section 4: Pre-save upcoming releases (Moved to Bottom) */}
      {(activeTab === 'all' || activeTab === 'songs') && (
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white hover:underline cursor-pointer tracking-tight">
                Pre-save upcoming releases
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Anticipated tracks & premiering singles</p>
            </div>
            <button
              onClick={() => playPlaylist(upcomingReleases, 0)}
              className="text-xs font-bold text-zinc-400 hover:text-white hover:underline px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {upcomingReleases.map(track => (
              <TrackCard key={track.id} item={track} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
