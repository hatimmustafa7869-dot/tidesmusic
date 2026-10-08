import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Folder,
  Globe,
  ListFilter,
  ListMusic,
  ListPlus,
  Loader2,
  Lock,
  MinusCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Pause,
  Plus,
  Search,
  Share2,
  Shuffle,
  User,
  UserPlus,
  X,
  XCircle
} from 'lucide-react';
import { TrackRow } from '../components/TrackRow';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';
import type { Playlist, Track } from '../types';

interface PlaylistViewProps {
  playlistId: string;
  onOpenAddToPlaylist: (track: Track) => void;
  onNavigateHome: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlistId,
  onOpenAddToPlaylist,
  onNavigateHome
}) => {
  const { playPlaylist, toggleShuffle, shuffle, isPlaying, currentTrack, addTracksToQueue, togglePlay } = useAudio();
  const {
    playlists,
    deletePlaylist,
    removeTrackFromPlaylist,
    saveRemotePlaylist,
    updatePlaylistDetails,
    addTracksToPlaylist,
    addTrackToPlaylist
  } = useLibrary();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState<Playlist | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Spotify-style dropdown & modals state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'folder' | 'other_playlist' | 'share' | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [isAddSongsOpen, setIsAddSongsOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Playlist options state
  const [isPrivate, setIsPrivate] = useState(false);
  const [isProfileHidden, setIsProfileHidden] = useState(false);
  const [isTasteExcluded, setIsTasteExcluded] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [sortBy, setSortBy] = useState<'custom' | 'title' | 'artist' | 'duration'>('custom');

  // Edit details form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editThumb, setEditThumb] = useState('');

  // Add songs search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const localPlaylist = playlists.find(p => p.id === playlistId);

  useEffect(() => {
    if (localPlaylist) {
      setPlaylistData(localPlaylist);
      setIsSaved(true);
      setLoading(false);
      setEditTitle(localPlaylist.title);
      setEditDesc(localPlaylist.description || '');
      setEditThumb(localPlaylist.thumbnail || '');
    } else {
      setLoading(true);
      api.getPlaylist(playlistId)
        .then(res => {
          const pl: Playlist = {
            id: playlistId,
            title: res.info?.title || 'Tides Playlist',
            description: res.info?.description || '',
            author: res.info?.author || 'Tides Music',
            thumbnail: res.info?.thumbnail || (res.tracks[0] ? res.tracks[0].thumbnail : ''),
            itemCount: res.tracks.length,
            isLocal: false,
            tracks: res.tracks || []
          };
          setPlaylistData(pl);
          setLoading(false);
          setEditTitle(pl.title);
          setEditDesc(pl.description || '');
          setEditThumb(pl.thumbnail || '');
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [playlistId, localPlaylist]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setActiveSubmenu(null);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#b3b3b3] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1ed760]" />
        <p className="text-sm font-semibold">Loading playlist...</p>
      </div>
    );
  }

  if (!playlistData) {
    return (
      <div className="text-center py-20 text-[#b3b3b3]">
        <p className="text-lg font-semibold">Playlist not found</p>
      </div>
    );
  }

  const rawTracks = playlistData.tracks || [];

  // Sort tracks according to sortBy selection
  const tracks = [...rawTracks].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '');
    if (sortBy === 'duration') return (a.duration || 0) - (b.duration || 0);
    return 0;
  });

  const totalDurationSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const formatTotalTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs} hr ${mins} min`;
    return `${mins} min`;
  };

  const isCurrentPlaylistPlaying = tracks.some(t => t.id === currentTrack?.id) && isPlaying;

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      playPlaylist(tracks, 0);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      if (!shuffle) toggleShuffle();
      const randIdx = Math.floor(Math.random() * tracks.length);
      playPlaylist(tracks, randIdx);
      showToast('Shuffle play started');
    }
  };

  // Option 1: Add to queue
  const handleAddToQueue = () => {
    addTracksToQueue(tracks);
    setIsMenuOpen(false);
    showToast(`Added ${tracks.length} songs to queue`);
  };

  const handleSaveToLibrary = async () => {
    if (playlistData) {
      await saveRemotePlaylist(playlistData, tracks);
      setIsSaved(true);
      showToast('Saved to Your Library');
    }
  };

  // Option 2: Remove/Add profile
  const handleToggleProfile = () => {
    setIsProfileHidden(prev => !prev);
    setIsMenuOpen(false);
    showToast(isProfileHidden ? 'Playlist added to your profile' : 'Playlist removed from your profile');
  };

  // Option 3: Edit details
  const handleOpenEdit = () => {
    setEditTitle(playlistData.title);
    setEditDesc(playlistData.description || '');
    setEditThumb(playlistData.thumbnail || '');
    setIsEditOpen(true);
    setIsMenuOpen(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    await updatePlaylistDetails(playlistData.id, editTitle.trim(), editDesc.trim(), editThumb.trim() || undefined);
    setPlaylistData(prev => prev ? {
      ...prev,
      title: editTitle.trim(),
      description: editDesc.trim(),
      thumbnail: editThumb.trim() || prev.thumbnail
    } : null);
    setIsEditOpen(false);
    showToast('Playlist details updated');
  };

  // Option 4: Delete
  const handleDeletePlaylist = () => {
    setIsMenuOpen(false);
    if (confirm(`Delete "${playlistData.title}" from your library?`)) {
      deletePlaylist(playlistData.id);
      showToast('Playlist deleted');
      onNavigateHome();
    }
  };

  // Option 5: Download playlist
  const handleDownload = () => {
    setIsDownloaded(prev => !prev);
    setIsMenuOpen(false);
    if (!isDownloaded) {
      // Generate .m3u playlist export
      const m3uContent = '#EXTM3U\n' + tracks.map(t => `#EXTINF:${t.duration || 180},${t.artist} - ${t.title}\nhttps://music.youtube.com/watch?v=${t.id}`).join('\n');
      const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${playlistData.title.replace(/\s+/g, '_')}.m3u`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Playlist downloaded for offline use');
    } else {
      showToast('Downloaded playlist removed');
    }
  };

  // Option 6: Make private / public
  const handleTogglePrivacy = () => {
    setIsPrivate(prev => !prev);
    setIsMenuOpen(false);
    showToast(isPrivate ? 'Playlist is now public' : 'Playlist is now private');
  };

  // Option 7: Invite collaborators
  const handleOpenCollab = () => {
    setIsCollabOpen(true);
    setIsMenuOpen(false);
  };

  // Option 8: Exclude taste profile
  const handleToggleTaste = () => {
    setIsTasteExcluded(prev => !prev);
    setIsMenuOpen(false);
    showToast(isTasteExcluded ? 'Included in taste profile' : 'Excluded from your taste profile');
  };

  // Option 9: Move to folder
  const handleMoveToFolder = (folderName: string) => {
    setIsMenuOpen(false);
    setActiveSubmenu(null);
    showToast(`Moved to folder "${folderName}"`);
  };

  // Option 10: Add to other playlist
  const handleAddToOtherPlaylist = async (targetPl: Playlist) => {
    await addTracksToPlaylist(targetPl.id, tracks);
    setIsMenuOpen(false);
    setActiveSubmenu(null);
    showToast(`Added ${tracks.length} songs to "${targetPl.title}"`);
  };

  // Option 11: Share
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
      setIsMenuOpen(false);
      setActiveSubmenu(null);
    });
  };

  const handleCopyEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/playlist/${playlistData.id}" width="100%" height="380" frameBorder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
      showToast('Embed code copied to clipboard!');
      setIsMenuOpen(false);
      setActiveSubmenu(null);
    });
  };

  // Search songs to add into this playlist
  const handleSearchSongs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await api.search(searchQuery.trim(), 'songs');
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrackDirect = async (track: Track) => {
    await addTrackToPlaylist(playlistData.id, track);
    setPlaylistData(prev => {
      if (!prev) return prev;
      if (prev.tracks.some(t => t.id === track.id)) return prev;
      const updated = [...prev.tracks, track];
      return {
        ...prev,
        tracks: updated,
        itemCount: updated.length
      };
    });
    showToast(`Added "${track.title}" to playlist`);
  };

  return (
    <div className="space-y-6 pb-28 animate-fade-in-up relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-2.5 bg-[#282828] border border-[#3e3e3e] shadow-2xl rounded-full text-white text-xs font-semibold animate-scale-up">
          <div className="w-2 h-2 rounded-full bg-[#1ed760]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Spotify Giant Playlist Banner */}
      <div className="relative -mx-4 md:-mx-8 -mt-6 p-6 md:p-8 pt-10 bg-gradient-to-b from-[#8a1474] via-[#381030]/90 to-[#121212] flex flex-col sm:flex-row items-center sm:items-end gap-6 select-none transition duration-300">
        <div className="relative group w-48 h-48 sm:w-56 sm:h-56 rounded shadow-2xl overflow-hidden shrink-0 bg-[#282828]">
          <img
            src={playlistData.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80'}
            alt={playlistData.title}
            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
          />
          <button
            onClick={handleOpenEdit}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white transition duration-200"
            title="Change photo"
          >
            <Pencil className="w-8 h-8" />
            <span className="text-xs font-bold">Choose photo</span>
          </button>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {isPrivate ? 'Private Playlist' : 'Public Playlist'}
            </span>
            {isTasteExcluded && (
              <span className="text-[10px] uppercase font-bold bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
                Excluded from Taste
              </span>
            )}
            {isProfileHidden && (
              <span className="text-[10px] uppercase font-bold bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
                Hidden from Profile
              </span>
            )}
          </div>

          <h1
            onClick={handleOpenEdit}
            className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight cursor-pointer hover:underline decoration-white/40"
            title="Click to edit name"
          >
            {playlistData.title}
          </h1>

          {playlistData.description && (
            <p className="text-xs sm:text-sm text-[#b3b3b3] max-w-2xl line-clamp-2">
              {playlistData.description}
            </p>
          )}

          {/* Metadata Row with Creator Avatars */}
          <div className="text-xs sm:text-sm text-zinc-300 flex items-center justify-center sm:justify-start gap-2 font-medium pt-1">
            <div className="flex items-center -space-x-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white border border-[#121212]">
                {playlistData.author ? playlistData.author.slice(0, 1).toUpperCase() : 'T'}
              </div>
              <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white border border-[#121212]">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
            <strong className="text-white hover:underline cursor-pointer">
              {playlistData.author || user?.username || 'You'}
            </strong>
            <span>&bull;</span>
            <span>{tracks.length} songs,</span>
            <span className="text-zinc-400">{formatTotalTime(totalDurationSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Row 1: Action Controls Row (Matches Spotify Desktop Screenshot) */}
      <div className="flex items-center gap-6 px-2 py-1 relative">
        {/* Giant Green Play Button */}
        <button
          onClick={handlePlayAll}
          disabled={tracks.length === 0}
          className="w-14 h-14 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 disabled:opacity-50 text-black flex items-center justify-center shadow-xl transition"
          title={isCurrentPlaylistPlaying ? 'Pause' : 'Play'}
        >
          {isCurrentPlaylistPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        {/* Current playing mini badge if active */}
        {currentTrack && isCurrentPlaylistPlaying && (
          <div className="w-9 h-9 rounded border-2 border-pink-500 overflow-hidden shrink-0 animate-pulse">
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Shuffle Button with Active Green Dot */}
        <button
          onClick={handleShufflePlay}
          disabled={tracks.length === 0}
          className="relative text-[#b3b3b3] hover:text-white transition flex flex-col items-center py-1"
          title="Shuffle"
        >
          <Shuffle className={`w-6 h-6 ${shuffle ? 'text-[#1ed760]' : ''}`} />
          {shuffle && (
            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#1ed760]" />
          )}
        </button>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className={`transition ${isDownloaded ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'}`}
          title={isDownloaded ? 'Downloaded' : 'Download for offline'}
        >
          <ArrowDownCircle className="w-6 h-6" />
        </button>

        {/* Invite Collaborators Button */}
        <button
          onClick={handleOpenCollab}
          className="text-[#b3b3b3] hover:text-white transition"
          title="Invite collaborators"
        >
          <UserPlus className="w-6 h-6" />
        </button>

        {/* More Options '...' Button with Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(prev => !prev)}
            className={`p-1.5 rounded-full transition ${isMenuOpen ? 'text-white bg-[#282828]' : 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'}`}
            title="More options"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>

          {/* Spotify Dropdown Context Menu */}
          {isMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl py-1.5 text-sm text-[#eaeaea] z-50 select-none animate-scale-up font-normal">
              {/* 1. Add to queue */}
              <button
                onClick={handleAddToQueue}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                <ListPlus className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Add to queue</span>
              </button>

              {/* 2. Remove from profile / Add to profile */}
              <button
                onClick={handleToggleProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                <User className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>{isProfileHidden ? 'Add to profile' : 'Remove from profile'}</span>
              </button>

              {/* 3. Edit details */}
              <button
                onClick={handleOpenEdit}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                <Pencil className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Edit details</span>
              </button>

              {/* 4. Delete */}
              <button
                onClick={handleDeletePlaylist}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-red-400 transition text-left"
              >
                <MinusCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Delete</span>
              </button>

              {/* 5. Download */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                <ArrowDownCircle className={`w-4 h-4 shrink-0 ${isDownloaded ? 'text-[#1ed760]' : 'text-zinc-400'}`} />
                <span>{isDownloaded ? 'Remove download' : 'Download'}</span>
              </button>

              {/* 6. Make private / Make public */}
              <button
                onClick={handleTogglePrivacy}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                {isPrivate ? (
                  <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                )}
                <span>{isPrivate ? 'Make public' : 'Make private'}</span>
              </button>

              {/* 7. Invite collaborators */}
              <button
                onClick={handleOpenCollab}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
              >
                <UserPlus className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Invite collaborators</span>
              </button>

              {/* 8. Exclude from taste profile */}
              <button
                onClick={handleToggleTaste}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left border-b border-[#383838]"
              >
                <XCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>{isTasteExcluded ? 'Include in taste profile' : 'Exclude from your taste profile'}</span>
              </button>

              {/* 9. Move to folder (Submenu) */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('folder')}
              >
                <button
                  onClick={() => setActiveSubmenu(activeSubmenu === 'folder' ? null : 'folder')}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Move to folder</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                {activeSubmenu === 'folder' && (
                  <div className="absolute left-full top-0 ml-1 w-52 bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl py-1.5 text-sm z-50">
                    <button
                      onClick={() => handleMoveToFolder('New Folder')}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-400" />
                      <span>New folder</span>
                    </button>
                    <button
                      onClick={() => handleMoveToFolder('Favorites')}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e]"
                    >
                      Favorites
                    </button>
                    <button
                      onClick={() => handleMoveToFolder('Chill Mixes')}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e]"
                    >
                      Chill Mixes
                    </button>
                    <button
                      onClick={() => handleMoveToFolder('Workout Energy')}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e]"
                    >
                      Workout Energy
                    </button>
                  </div>
                )}
              </div>

              {/* 10. Add to other playlist (Submenu) */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('other_playlist')}
              >
                <button
                  onClick={() => setActiveSubmenu(activeSubmenu === 'other_playlist' ? null : 'other_playlist')}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <Plus className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Add to other playlist</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                {activeSubmenu === 'other_playlist' && (
                  <div className="absolute left-full top-0 ml-1 w-56 max-h-60 overflow-y-auto bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl py-1.5 text-sm z-50">
                    {playlists.filter(p => p.id !== playlistData.id).length === 0 ? (
                      <div className="px-4 py-2.5 text-xs text-zinc-400">No other playlists</div>
                    ) : (
                      playlists
                        .filter(p => p.id !== playlistData.id)
                        .map(pl => (
                          <button
                            key={pl.id}
                            onClick={() => handleAddToOtherPlaylist(pl)}
                            className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] truncate block text-white"
                          >
                            {pl.title}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* 11. Share (Submenu) */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('share')}
              >
                <button
                  onClick={() => setActiveSubmenu(activeSubmenu === 'share' ? null : 'share')}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#3e3e3e] hover:text-white transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Share</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                {activeSubmenu === 'share' && (
                  <div className="absolute left-full top-0 ml-1 w-52 bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl py-1.5 text-sm z-50">
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy link to playlist</span>
                    </button>
                    <button
                      onClick={handleCopyEmbed}
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy embed code</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Check out this playlist "${playlistData.title}" on Tides Music: ${window.location.href}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] block"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Share to WhatsApp
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to "${playlistData.title}" on Tides Music! 🎵`)}&url=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 text-left hover:bg-[#3e3e3e] block"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Share to X (Twitter)
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Pills Row (+ Add, ✎ Name & details, and Custom Order Dropdown) */}
      <div className="flex items-center justify-between px-2 pt-1 border-b border-[#282828]/60 pb-3">
        <div className="flex items-center gap-3">
          {/* Save to Library Pill if not already saved */}
          {!isSaved && (
            <button
              onClick={handleSaveToLibrary}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black hover:scale-105 active:scale-95 text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Save to Library</span>
            </button>
          )}

          {/* + Add Pill */}
          <button
            onClick={() => setIsAddSongsOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/20 hover:border-white text-white hover:scale-105 active:scale-95 text-xs font-bold transition shadow-sm bg-[#181818]/60"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>

          {/* ✎ Name & details Pill */}
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/20 hover:border-white text-white hover:scale-105 active:scale-95 text-xs font-bold transition shadow-sm bg-[#181818]/60"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Name & details</span>
          </button>
        </div>

        {/* Custom Order Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setIsSortOpen(prev => !prev)}
            className="flex items-center gap-2 text-xs font-semibold text-[#b3b3b3] hover:text-white transition px-3 py-1.5 rounded hover:bg-[#282828]"
          >
            <span>
              {sortBy === 'custom' && 'Custom order'}
              {sortBy === 'title' && 'Title'}
              {sortBy === 'artist' && 'Artist'}
              {sortBy === 'duration' && 'Duration'}
            </span>
            <ListFilter className="w-4 h-4" />
          </button>

          {isSortOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl py-1 text-xs text-[#eaeaea] z-50">
              <button
                onClick={() => { setSortBy('custom'); setIsSortOpen(false); }}
                className={`w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center justify-between ${sortBy === 'custom' ? 'text-[#1ed760] font-bold' : ''}`}
              >
                <span>Custom order</span>
                {sortBy === 'custom' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setSortBy('title'); setIsSortOpen(false); }}
                className={`w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center justify-between ${sortBy === 'title' ? 'text-[#1ed760] font-bold' : ''}`}
              >
                <span>Title</span>
                {sortBy === 'title' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setSortBy('artist'); setIsSortOpen(false); }}
                className={`w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center justify-between ${sortBy === 'artist' ? 'text-[#1ed760] font-bold' : ''}`}
              >
                <span>Artist</span>
                {sortBy === 'artist' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setSortBy('duration'); setIsSortOpen(false); }}
                className={`w-full px-4 py-2 text-left hover:bg-[#3e3e3e] flex items-center justify-between ${sortBy === 'duration' ? 'text-[#1ed760] font-bold' : ''}`}
              >
                <span>Duration</span>
                {sortBy === 'duration' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="border-b border-[#282828] pb-2 px-4 flex items-center justify-between text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider">
        <div className="flex items-center gap-4 flex-1">
          <span className="w-5 text-center">#</span>
          <span>Title</span>
        </div>
        <div className="flex items-center gap-4">
          <Clock className="w-4 h-4 mr-10" />
        </div>
      </div>

      {/* Tracks List */}
      <div className="space-y-0.5">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#b3b3b3] gap-3">
            <ListMusic className="w-12 h-12 stroke-1 opacity-40 text-[#1ed760]" />
            <p className="text-base font-bold text-white">This playlist is empty</p>
            <p className="text-xs text-[#b3b3b3]">Click "+ Add" above to add your favorite songs.</p>
            <button
              onClick={() => setIsAddSongsOpen(true)}
              className="mt-2 px-5 py-2 text-xs font-bold bg-white text-black hover:scale-105 rounded-full transition shadow"
            >
              Find songs
            </button>
          </div>
        ) : (
          tracks.map((track, idx) => (
            <TrackRow
              key={`${track.id}-${idx}`}
              track={track}
              index={idx}
              tracksContext={tracks}
              onAddToPlaylist={onOpenAddToPlaylist}
              onRemoveFromPlaylist={playlistData.isLocal ? (tId) => removeTrackFromPlaylist(playlistData.id, tId) : undefined}
            />
          ))
        )}
      </div>

      {/* MODAL 1: Edit Details Modal (Spotify Desktop Layout) */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#282828] border border-[#3e3e3e] rounded-xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Edit details</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-[#383838] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Photo Preview / Change */}
                <div className="relative group w-44 h-44 rounded-lg bg-[#181818] overflow-hidden shrink-0 border border-[#3e3e3e] flex items-center justify-center">
                  <img
                    src={editThumb || playlistData.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80'}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition">
                    <Pencil className="w-6 h-6" />
                    <span>Change photo</span>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 bg-[#3e3e3e]/80 border border-[#555] rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-white transition text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Description
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      placeholder="Add an optional description"
                      className="w-full px-3.5 py-2 bg-[#3e3e3e]/80 border border-[#555] rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-white transition resize-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={editThumb}
                      onChange={e => setEditThumb(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                      className="w-full px-3.5 py-1.5 bg-[#3e3e3e]/80 border border-[#555] rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-white transition text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim()}
                  className="px-6 py-2.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 rounded-full transition shadow"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Invite Collaborators Modal */}
      {isCollabOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#282828] border border-[#3e3e3e] rounded-xl p-6 shadow-2xl text-white space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-[#1ed760] rounded-xl">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Invite collaborators</h3>
                  <p className="text-xs text-zinc-400">Share this playlist and build it together</p>
                </div>
              </div>
              <button
                onClick={() => setIsCollabOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-[#383838] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-300">Invite Link</label>
              <div className="flex items-center gap-2 bg-[#181818] border border-[#3e3e3e] rounded-lg p-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/playlist/${playlistData.id}?collab=true`}
                  className="w-full bg-transparent text-xs text-zinc-300 outline-none select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/playlist/${playlistData.id}?collab=true`);
                    showToast('Invite link copied to clipboard!');
                    setIsCollabOpen(false);
                  }}
                  className="px-3 py-1.5 bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs rounded-full transition shadow shrink-0"
                >
                  Copy link
                </button>
              </div>
            </div>

            <div className="border-t border-[#3e3e3e] pt-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Collaborators</h4>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                    {playlistData.author ? playlistData.author.slice(0, 1).toUpperCase() : 'Y'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{playlistData.author || user?.username || 'You'}</p>
                    <p className="text-[10px] text-zinc-400">Owner</p>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400">Can manage</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Songs to Playlist Modal */}
      {isAddSongsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-[#222] border border-[#383838] rounded-xl p-6 shadow-2xl text-white space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#1ed760]/10 text-[#1ed760] rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add songs to {playlistData.title}</h3>
                  <p className="text-xs text-zinc-400">Search for tracks and add them directly</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddSongsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-[#383838] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSongs} className="shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for song title or artist..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 bg-[#181818] border border-[#3e3e3e] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="px-5 py-2.5 bg-[#1ed760] hover:bg-[#1fdf64] disabled:opacity-50 text-black font-bold text-xs rounded-lg transition"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </form>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  {isSearching ? 'Searching tracks...' : 'Search above to discover songs to add'}
                </div>
              ) : (
                searchResults.map(track => {
                  const alreadyAdded = playlistData.tracks.some(t => t.id === track.id);
                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2e2e2e] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddTrackDirect(track)}
                        disabled={alreadyAdded}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full transition shrink-0 ml-3 ${
                          alreadyAdded
                            ? 'bg-zinc-700 text-zinc-400 cursor-default'
                            : 'bg-white hover:bg-zinc-200 text-black hover:scale-105 active:scale-95'
                        }`}
                      >
                        {alreadyAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
