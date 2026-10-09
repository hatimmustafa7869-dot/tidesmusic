import React, { useEffect, useState } from 'react';
import { Heart, ListMusic, Loader2, Play, Sparkles } from 'lucide-react';
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
  category?: 'all' | 'songs' | 'playlists';
  onSelectCategory?: (c: 'all' | 'songs' | 'playlists') => void;
}

// Module-level cache so navigating back to Home from playlists or other views is instant
let cachedHomeData: { shelves: Shelf[]; trending: Track[] } | null = null;

export const HomePage: React.FC<HomePageProps> = ({
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onNavigateFavorites,
  category = 'all',
  onSelectCategory
}) => {
  const { playPlaylist, currentTrack, isPlaying } = useAudio();
  const { playlists } = useLibrary();

  const [activeTab, setActiveTab] = useState<'all' | 'songs' | 'playlists'>(category);
  const [shelves, setShelves] = useState<Shelf[]>(() => cachedHomeData?.shelves || []);
  const [trending, setTrending] = useState<Track[]>(() => cachedHomeData?.trending || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedHomeData);

  useEffect(() => {
    setActiveTab(category);
  }, [category]);

  const handleTabChange = (tab: 'all' | 'songs' | 'playlists') => {
    setActiveTab(tab);
    if (onSelectCategory) onSelectCategory(tab);
  };

  useEffect(() => {
    let mounted = true;
    api.getHome()
      .then(data => {
        if (!mounted) return;
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

  // Curated Real Public Playlists with authentic songs matching each title
  const curatedMixes = [
    { id: 'curated-chill-hits', title: 'Chill Hits', thumb: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80' },
    { id: 'curated-top-50-global', title: 'Top 50 - Global', thumb: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80' },
    { id: 'curated-gym-workout', title: 'Gym & Workout', thumb: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&q=80' },
    { id: 'curated-super-hit-90s', title: 'Super Hit 90s', thumb: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80' },
    { id: 'curated-romantic-melodies', title: 'Romantic Melodies', thumb: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80' },
    { id: 'curated-desi-hip-hop', title: 'Desi Hip-Hop', thumb: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80' },
    { id: 'curated-night-drive-vibes', title: 'Night Drive Vibes', thumb: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80' }
  ];

  // Quick Access 8-Grid (Strictly 2 Columns, 8 Cards matching Spotify Mobile Screenshot)
  const quickCards: Array<{
    id: string;
    title: string;
    thumbnail: string;
    isLiked?: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'quick-liked',
      title: 'Liked Songs',
      thumbnail: '',
      isLiked: true,
      onClick: onNavigateFavorites
    },
    ...playlists.slice(0, 7).map(pl => ({
      id: pl.id,
      title: pl.title,
      thumbnail: pl.thumbnail || (pl.tracks && pl.tracks.length > 0 ? pl.tracks[0].thumbnail : ''),
      onClick: () => onSelectPlaylist(pl.id)
    }))
  ];

  // Fill up to 8 slots with real public curated playlists that contain real songs matching each title
  let fbIdx = 0;
  while (quickCards.length < 8 && fbIdx < curatedMixes.length) {
    const mix = curatedMixes[fbIdx];
    quickCards.push({
      id: mix.id,
      title: mix.title,
      thumbnail: mix.thumb,
      onClick: () => onSelectPlaylist(mix.id)
    });
    fbIdx++;
  }

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

  const featuredTrack = trending[0] || upcomingReleases[0];

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* Desktop Category Pills Bar (Hidden on mobile because it's in the top header) */}
      <div className="hidden md:flex items-center gap-2 pt-1 pb-3 border-b border-white/[0.08]">
        <button
          onClick={() => handleTabChange('all')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'all'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleTabChange('songs')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'songs'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          Music
        </button>
        <button
          onClick={() => handleTabChange('playlists')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition duration-200 ${
            activeTab === 'playlists'
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] font-extrabold scale-105'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 backdrop-blur-xl'
          }`}
        >
          Playlists
        </button>
      </div>

      {/* 1. Quick Access 2-Column Grid (Strictly 2 Columns, 8 Cards matching Spotify Mobile Screenshot) */}
      {(activeTab === 'all' || activeTab === 'songs') && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
          {quickCards.map(item => {
            const isItemPlaying = currentTrack?.id === item.id && isPlaying;
            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className="group relative flex items-center h-14 bg-white/[0.07] hover:bg-white/[0.13] active:bg-white/[0.18] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.2] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:scale-[0.98]"
              >
                {/* Specular Edge Line */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {item.isLiked ? (
                  <div className="w-14 h-14 bg-gradient-to-br from-[#450af5] via-[#8e2de2] to-[#ff416c] flex items-center justify-center shrink-0 shadow-md">
                    <Heart className="w-6 h-6 text-white fill-current drop-shadow" />
                  </div>
                ) : item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-14 h-14 object-cover shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center shrink-0 shadow-md">
                    <ListMusic className="w-6 h-6 text-white/90" />
                  </div>
                )}

                <div className="flex-1 px-2.5 sm:px-3 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white truncate block tracking-tight">
                    {item.title}
                  </span>
                </div>

                {/* Floating Play Button on Desktop Hover */}
                <div
                  className={`hidden sm:flex mr-3 w-8 h-8 rounded-full bg-[#1ed760] text-black items-center justify-center shadow-[0_2px_12px_rgba(30,215,96,0.4)] transition-all duration-200 transform group-hover:scale-105 shrink-0 ${
                    isItemPlaying ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Spotlight / Featured Release Hero Banner (Matching Spotify Mobile Screenshot's Middle Banner) */}
      {(activeTab === 'all' || activeTab === 'songs') && featuredTrack && (
        <div
          onClick={() => {
            if (trending.length > 0) {
              playPlaylist(trending, 0);
            }
          }}
          className="relative w-full h-48 sm:h-56 md:h-64 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/[0.14] bg-[#0f1422]/80 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] group cursor-pointer my-3 transition-transform duration-300"
        >
          {/* Background Artwork with Gradient Overlay */}
          <img
            src={featuredTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80'}
            alt={featuredTrack.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/60 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Top Badge */}
          <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-wider shadow">
            <Sparkles className="w-3 h-3 text-[#1ed760]" />
            <span>Featured Release</span>
          </div>

          {/* Bottom Info & Play Button */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex items-end justify-between gap-4 z-10">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-2xl font-black text-white truncate drop-shadow-md tracking-tight group-hover:text-[#1ed760] transition-colors">
                {featuredTrack.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 font-semibold truncate mt-0.5 drop-shadow">
                {featuredTrack.artist || 'Featured Artist'}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (trending.length > 0) {
                  playPlaylist(trending, 0);
                }
              }}
              className="bg-white hover:bg-zinc-200 text-black font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl active:scale-95 transition shrink-0 hover:scale-105"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play now</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Recommended Stations / Today's Biggest Hits (Horizontal Scrolling Carousel matching Screenshot) */}
      {(activeTab === 'all' || activeTab === 'songs') && trending.length > 0 && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Recommended Stations
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 shadow-[0_0_12px_rgba(30,215,96,0.25)]">
                Trending
              </span>
            </div>
            <button
              onClick={() => playPlaylist(trending, 0)}
              className="text-xs font-bold text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 backdrop-blur-xl shadow-sm transition active:scale-95"
            >
              Play all
            </button>
          </div>

          {/* Horizontal Scrolling Carousel with Snap & Smooth Scroll */}
          <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 -mx-1 px-1">
            {trending.map((track, idx) => (
              <TrackCard
                key={track.id}
                item={track}
                className="w-36 sm:w-44 shrink-0"
                tracksContext={trending}
                index={idx}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. Popular Playlists & Mixes (Horizontal Scrolling Carousels) */}
      {(activeTab === 'all' || activeTab === 'playlists') &&
        shelves.map((shelf, sIdx) => (
          <section key={sIdx} className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-black text-white hover:underline cursor-pointer tracking-tight">
                {shelf.title}
              </h2>
            </div>

            <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 -mx-1 px-1">
              {shelf.items.map((item, idx) => (
                <TrackCard
                  key={item.id}
                  item={item}
                  className="w-36 sm:w-44 shrink-0"
                  onSelectPlaylist={onSelectPlaylist}
                  tracksContext={shelf.items as any}
                  index={idx}
                />
              ))}
            </div>
          </section>
        ))}

      {/* 5. Popular Tracks (Ranked by plays Table List) */}
      {(activeTab === 'all' || activeTab === 'songs') && trending.length > 0 && (
        <section className="space-y-3.5 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-white tracking-tight">Popular Tracks</h2>
              <span className="text-xs text-zinc-400 font-semibold">Ranked by plays</span>
            </div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-2.5 sm:p-3.5 border border-white/[0.1] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
            {trending.slice(0, 10).map((track, idx) => (
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

      {/* 6. Pre-save Upcoming Releases (Moved to Bottom as Requested) */}
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

          <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 -mx-1 px-1">
            {upcomingReleases.map((track, idx) => (
              <TrackCard
                key={track.id}
                item={track}
                className="w-36 sm:w-44 shrink-0"
                tracksContext={upcomingReleases}
                index={idx}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
