import React, { useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
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
import { JamProvider } from './context/JamContext';
import { LibraryProvider } from './context/LibraryContext';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { PlaylistView } from './pages/PlaylistView';
import { SearchPage } from './pages/SearchPage';
import type { Track } from './types';

export const MainApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'search' | 'playlist' | 'favorites' | 'history'>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');

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

  // Keyboard Shortcuts (Spotify Standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
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

  interface NavState {
    view: 'home' | 'search' | 'playlist' | 'favorites' | 'history';
    playlistId?: string;
    searchQuery?: string;
  }

  const [navHistory, setNavHistory] = useState<NavState[]>([{ view: 'home' }]);
  const [navIndex, setNavIndex] = useState(0);

  const applyNavState = (state: NavState) => {
    setCurrentView(state.view);
    if (state.playlistId) setSelectedPlaylistId(state.playlistId);
    if (state.searchQuery !== undefined) setSearchQuery(state.searchQuery);
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
    applyNavState(nextState);
  };

  const handleGoBack = () => {
    if (navIndex > 0) {
      const targetIdx = navIndex - 1;
      setNavIndex(targetIdx);
      applyNavState(navHistory[targetIdx]);
    }
  };

  const handleGoForward = () => {
    if (navIndex < navHistory.length - 1) {
      const targetIdx = navIndex + 1;
      setNavIndex(targetIdx);
      applyNavState(navHistory[targetIdx]);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {/* 1. Spotify Global Desktop Top Bar */}
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
      />

      {/* 2. Main 3-Pane Desktop Layout: Left Sidebar + Center Content + Right Now Playing Sidebar */}
      <div className="flex-1 flex overflow-hidden px-2 pb-2 gap-2 min-h-0">
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

        {/* Center: Main Content Panel (Rounded container bg-[#121212]) */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#121212] rounded-lg overflow-hidden relative border border-white/5 shadow-inner">
          <main className="flex-1 overflow-y-auto px-4 md:px-7 py-4">
            {currentView === 'home' && (
              <HomePage
                onSelectPlaylist={handleSelectPlaylist}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
                onNavigateFavorites={() => setCurrentView('favorites')}
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
