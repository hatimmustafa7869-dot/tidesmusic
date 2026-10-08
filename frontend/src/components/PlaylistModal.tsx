import React, { useState } from 'react';
import { Download, ListPlus, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { api } from '../services/api';
import type { Track } from '../types';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'import' | 'add_track';
  trackToAdd?: Track | null;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  mode,
  trackToAdd
}) => {
  const { createPlaylist, playlists, addTrackToPlaylist, saveRemotePlaylist } = useLibrary();
  const { isAuthenticated } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const pl = await createPlaylist(title.trim(), description.trim());
    if (trackToAdd) {
      await addTrackToPlaylist(pl.id, trackToAdd);
    }
    setTitle('');
    setDescription('');
    onClose();
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    const playlistId = api.parsePlaylistIdFromUrl(importUrl);
    if (!playlistId) {
      setImportError('Invalid playlist URL or ID.');
      return;
    }

    setIsImporting(true);
    try {
      const data = await api.getPlaylist(playlistId);
      if (!data.tracks || data.tracks.length === 0) {
        setImportError('No tracks found in this playlist. Please check privacy settings.');
        setIsImporting(false);
        return;
      }
      await saveRemotePlaylist(data.info, data.tracks);
      setImportUrl('');
      setIsImporting(false);
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Failed to import playlist.');
      setIsImporting(false);
    }
  };

  const handleAddToExisting = async (playlistId: string) => {
    if (!trackToAdd) return;
    await addTrackToPlaylist(playlistId, trackToAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#121212] border border-[#282828] rounded-xl p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-[#282828] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-[#1ed760]/10 text-[#1ed760] rounded-xl">
                <ListPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">New Playlist</h3>
                <p className="text-xs text-zinc-400">
                  {isAuthenticated ? 'Saved to your cloud account' : 'Created in local library'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My playlist #1"
                required
                className="w-full px-4 py-2.5 bg-[#1e1e1e] border border-[#333] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add an optional description"
                rows={2}
                className="w-full px-4 py-2 bg-[#1e1e1e] border border-[#333] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition resize-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-6 py-2.5 text-xs font-bold bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 disabled:opacity-50 text-black rounded-full transition shadow"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {mode === 'import' && (
          <form onSubmit={handleImport} className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-[#1ed760]/10 text-[#1ed760] rounded-xl">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Import Playlist</h3>
                <p className="text-xs text-zinc-400">Paste any public playlist link (Spotify, YouTube, etc.)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Playlist URL or ID
              </label>
              <input
                type="text"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="Paste Spotify, YouTube, or public playlist link..."
                required
                className="w-full px-4 py-2.5 bg-[#1e1e1e] border border-[#333] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#1ed760] transition text-sm"
                autoFocus
              />
            </div>

            {importError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {importError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!importUrl.trim() || isImporting}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 disabled:opacity-50 text-black rounded-full transition shadow"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Importing...
                  </>
                ) : (
                  'Import & Save'
                )}
              </button>
            </div>
          </form>
        )}

        {mode === 'add_track' && trackToAdd && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-[#1ed760]/10 text-[#1ed760] rounded-xl">
                <ListPlus className="w-6 h-6" />
              </div>
              <div className="truncate">
                <h3 className="text-lg font-bold text-white truncate">Add to Playlist</h3>
                <p className="text-xs text-zinc-400 truncate">{trackToAdd.title}</p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => handleAddToExisting(pl.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#181818] hover:bg-[#282828] text-left transition group"
                >
                  <div className="flex items-center gap-3 truncate">
                    <img
                      src={pl.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80'}
                      alt={pl.title}
                      className="w-9 h-9 rounded object-cover"
                    />
                    <div className="truncate">
                      <div className="text-sm font-bold text-white group-hover:text-[#1ed760] transition truncate">
                        {pl.title}
                      </div>
                      <div className="text-xs text-[#b3b3b3]">
                        {pl.itemCount ?? pl.tracks?.length ?? 0} tracks
                      </div>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-zinc-400 group-hover:text-[#1ed760] transition" />
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#282828] flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
