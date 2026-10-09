import React, { useEffect, useRef, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { DownloadAppModal } from './components/DownloadAppModal';
import { JamModal } from './components/JamModal';
import { Navbar } from './components/Navbar';
import { NowPlayingModal } from './components/NowPlayingModal';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { Player } from './components/Player';
import { PlaylistModal } from './components/PlaylistModal';
import { QueueDrawer } from './components/QueueDrawer';
import { Sidebar } from './components/Sidebar';
import { AudioProvider, useAudio } from './context/AudioContext';
import { AuthProvider } from './context/AuthContext';
import { JamProvider, useJam } from './context/JamContext';
import { LibraryProvider } from './context/LibraryContext';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { PlaylistView } from './pages/PlaylistView';
import { SearchPage } from './pages/SearchPage';
import type { Track } from './types';

interface NavState {
  view: 'home' | 'search' | 'playlist' | 'favorites' | 'history';
  playlistId?: string;
  searchQuery?: string;
}

const getInitialRoute = (): NavState => {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryPl = searchParams.get('playlist') || searchParams.get('pl') || searchParams.get('id');
    if (queryPl) {
      return { view: 'playlist', playlistId: queryPl.trim() };
    }
    const searchQ = searchParams.get('q') || searchParams.get('search');
    if (searchQ) {
      return { view: 'search', searchQuery: searchQ.trim() };
    }

    const pathname = window.location.pathname;
    const pathMatch = pathname.match(/^\/playlist\/(.+)/);
    if (pathMatch && pathMatch[1]) {
      return { view: 'playlist', playlistId: decodeURIComponent(pathMatch[1]).trim() };
    }

    const hash = window.location.hash;
    const hashMatch = hash.match(/^#\/?playlist\/(.+)/);
    if (hashMatch && hashMatch[1]) {
      return { view: 'playlist', playlistId: decodeURIComponent(hashMatch[1]).trim() };
    }
  } catch {}
  return { view: 'home' };
};

export const MainApp: React.FC = () => {
  const initialRoute = useRef(getInitialRoute()).current;
  const [currentView, setCurrentView] = useState<'home' | 'search' | 'playlist' | 'favorites' | 'history'>(initialRoute.view);
  const [homeCategory, setHomeCategory] = useState<'all' | 'songs' | 'playlists'>('all');
  const [searchQuery, setSearchQuery] = useState<string>(initialRoute.searchQuery || '');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(initialRoute.playlistId || '');

  // Modals & Panels
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true); // Open by default matching screenshot
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const [playlistModalMode, setPlaylistModalMode] = useState<'create' | 'import' | 'add_track' | null>(null);
  const [trackForPlaylist, setTrackForPlaylist] = useState<Track | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const { togglePlay, seek, currentTime, duration, setVolume, volume, toggleMute, nextTrack, prevTrack } = useAudio();
  const { isJamActive, setIsJamModalOpen } = useJam();

  // Keyboard & Hardware Media Keys Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hardware Media Keys should work even if focused in inputs
      const isPlayPause =
        e.key === 'MediaPlayPause' ||
        e.code === 'MediaPlayPause' ||
        e.keyCode === 85 ||
        e.keyCode === 179 ||
        e.key === 'HeadsetHook' ||
        e.code === 'HeadsetHook' ||
        e.keyCode === 79;

      const isNext =
        e.key === 'MediaTrackNext' ||
        e.code === 'MediaTrackNext' ||
        e.keyCode === 87 ||
        e.keyCode === 176;

      const isPrev =
        e.key === 'MediaTrackPrevious' ||
        e.code === 'MediaTrackPrevious' ||
        e.keyCode === 88 ||
        e.keyCode === 177;

      const isStop =
        e.key === 'MediaStop' ||
        e.code === 'MediaStop' ||
        e.keyCode === 86 ||
        e.keyCode === 178;

      if (isPlayPause) {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (isNext) {
        e.preventDefault();
        nextTrack();
        return;
      }
      if (isPrev) {
        e.preventDefault();
        prevTrack();
        return;
      }
      if (isStop) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Ignore standard typing keys if typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        nextTrack();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        prevTrack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(duration, currentTime + 5));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, currentTime, duration, setVolume, volume, toggleMute, nextTrack, prevTrack]);

  const [navHistory, setNavHistory] = useState<NavState[]>([
    ...(initialRoute.view !== 'home' ? [{ view: 'home' as const }, initialRoute] : [initialRoute])
  ]);
  const [navIndex, setNavIndex] = useState(initialRoute.view !== 'home' ? 1 : 0);

  const updateUrlForState = (state: NavState, replace: boolean = false) => {
    try {
      let targetUrl = '/';
      if (state.view === 'playlist' && state.playlistId) {
        targetUrl = `/?playlist=${encodeURIComponent(state.playlistId)}`;
      } else if (state.view === 'search' && state.searchQuery) {
        targetUrl = `/?search=${encodeURIComponent(state.searchQuery)}`;
      } else if (state.view === 'favorites') {
        targetUrl = `/?view=favorites`;
      } else if (state.view === 'history') {
        targetUrl = `/?view=history`;
      }

      const currentPathAndSearch = window.location.pathname + window.location.search;
      if (currentPathAndSearch !== targetUrl && window.location.search !== targetUrl) {
        if (replace) {
          window.history.replaceState({ state }, '', targetUrl);
        } else {
          window.history.pushState({ state }, '', targetUrl);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      applyNavState(route, false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const applyNavState = (state: NavState, updateHistory: boolean = true) => {
    setCurrentView(state.view);
    if (state.playlistId) setSelectedPlaylistId(state.playlistId);
    if (state.searchQuery !== undefined) setSearchQuery(state.searchQuery);
    if (updateHistory) {
      updateUrlForState(state);
    }
  };

  const handleNavigate = (view: string, data?: any) => {
    const nextState: NavState = {
      view: view as any,
      playlistId: data?.playlistId,
      searchQuery: view === 'search' ? (data?.searchQuery || searchQuery) : undefined
    };

    const current = navHistory[navIndex];
    if (current && current.view === nextState.view && current.playlistId === nextState.playlistId) {
      return;
    }

    const nextHistory = navHistory.slice(0, navIndex + 1);
    nextHistory.push(nextState);
    setNavHistory(nextHistory);
    setNavIndex(nextHistory.length - 1);
    applyNavState(nextState, true);
  };

  const handleGoBack = () => {
    if (navIndex > 0) {
      const targetIdx = navIndex - 1;
      setNavIndex(targetIdx);
      applyNavState(navHistory[targetIdx], true);
    }
  };

  const handleGoForward = () => {
    if (navIndex < navHistory.length - 1) {
      const targetIdx = navIndex + 1;
      setNavIndex(targetIdx);
      applyNavState(navHistory[targetIdx], true);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (currentView !== 'search') {
      handleNavigate('search', { searchQuery: query });
    }
  };

  const handleSelectPlaylist = (playlistId: string) => {
    handleNavigate('playlist', { playlistId });
  };

  const handleOpenAddToPlaylist = (track: Track) => {
    setTrackForPlaylist(track);
    setPlaylistModalMode('add_track');
  };

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-white font-sans selection:bg-[#1ed760]/30 selection:text-white">
      {/* Dynamic Ambient Lighting Canvas for Authentic Glassmorphism Refraction */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[620px] h-[620px] bg-gradient-to-br from-indigo-500/25 via-purple-600/15 to-transparent rounded-full blur-[140px] z-0 animate-pulse duration-1000" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-[620px] h-[620px] bg-gradient-to-tl from-emerald-500/20 via-teal-600/15 to-transparent rounded-full blur-[140px] z-0" />
      <div className="pointer-events-none fixed top-1/4 right-1/3 w-[520px] h-[520px] bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-transparent rounded-full blur-[160px] z-0" />

      {/* 1. Spotify Global Desktop Top Bar / Mobile Header */}
      <Navbar
        onSearch={handleSearch}
        onNavigateHome={() => handleNavigate('home')}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        onOpenImport={() => setPlaylistModalMode('import')}
        onOpenAuth={handleOpenAuth}
        onOpenDownloadApp={() => setIsDownloadModalOpen(true)}
        initialQuery={searchQuery}
        showSearchBar={currentView === 'search'}
        canGoBack={navIndex > 0}
        canGoForward={navIndex < navHistory.length - 1}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        currentView={currentView}
        activeCategory={homeCategory}
        onSelectCategory={setHomeCategory}
      />

      {/* 2. Main 3-Pane Desktop Layout: Left Sidebar + Center Content + Right Now Playing Sidebar */}
      <div className="relative z-10 flex-1 flex overflow-hidden p-0 md:p-1.5 md:px-3 md:pb-3 gap-0 md:gap-3 min-h-0">
        {/* Left: Your Library Sidebar */}
        <Sidebar
          currentView={currentView}
          selectedPlaylistId={selectedPlaylistId}
          onNavigate={handleNavigate}
          onOpenCreatePlaylist={() => setPlaylistModalMode('create')}
          onOpenImportPlaylist={() => setPlaylistModalMode('import')}
          onOpenDownloadApp={() => setIsDownloadModalOpen(true)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center: Main Content Panel (Glassmorphic Container with top specular highlight) */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0b0e17]/65 backdrop-blur-3xl rounded-none md:rounded-3xl overflow-hidden relative border-0 md:border md:border-white/[0.12] shadow-none md:shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-20" />
          <main className="flex-1 overflow-y-auto no-scrollbar px-3 sm:px-4 md:px-7 py-2 sm:py-4 pb-36 md:pb-8">
            {currentView === 'home' && (
              <HomePage
                onSelectPlaylist={handleSelectPlaylist}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
                onNavigateFavorites={() => setCurrentView('favorites')}
                category={homeCategory}
                onSelectCategory={setHomeCategory}
              />
            )}

            {currentView === 'search' && (
              <SearchPage
                initialQuery={searchQuery}
                onSelectPlaylist={handleSelectPlaylist}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            )}

            {currentView === 'playlist' && (
              <PlaylistView
                playlistId={selectedPlaylistId}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
                onNavigateHome={() => handleNavigate('home')}
              />
            )}

            {currentView === 'favorites' && (
              <FavoritesPage
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            )}

            {currentView === 'history' && (
              <HistoryPage
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            )}
          </main>
        </div>

        {/* Right: Now Playing Side Panel (Matches Spotify Desktop Screenshot) */}
        {isRightSidebarOpen && (
          <NowPlayingSidebar
            onClose={() => setIsRightSidebarOpen(false)}
            onOpenLyricsModal={() => setIsNowPlayingOpen(true)}
          />
        )}
      </div>

      {/* 3. Spotify Bottom Audio Player Bar */}
      <Player
        onOpenQueue={() => setIsQueueOpen(!isQueueOpen)}
        onOpenLyrics={() => setIsNowPlayingOpen(true)}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        isQueueOpen={isQueueOpen}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
      />

      {/* 4. Spotify Mobile Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenJam={() => setIsJamModalOpen(true)}
        onOpenCreate={() => setPlaylistModalMode('create')}
        onOpenLibrary={() => setIsMobileSidebarOpen(true)}
        isJamActive={isJamActive}
      />

      {/* Slide-out Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />

      {/* Fullscreen Now Playing & Lyrics Modal */}
      <NowPlayingModal
        isOpen={isNowPlayingOpen}
        onClose={() => setIsNowPlayingOpen(false)}
      />

      {/* Playlist Create / Import / Add Track Modal */}
      <PlaylistModal
        isOpen={playlistModalMode !== null}
        onClose={() => {
          setPlaylistModalMode(null);
          setTrackForPlaylist(null);
        }}
        mode={playlistModalMode || 'create'}
        trackToAdd={trackForPlaylist}
      />

      {/* Spotify Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Tides Music Download App Modal (Android APK + PC App) */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* Spotify Jam Collaborative Live Listening Modal */}
      <JamModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LibraryProvider>
        <AudioProvider>
          <JamProvider>
            <MainApp />
          </JamProvider>
        </AudioProvider>
      </LibraryProvider>
    </AuthProvider>
  );
}
