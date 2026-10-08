import React, { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Radio,
  Share2,
  UserMinus,
  Users,
  X
} from 'lucide-react';
import { useJam } from '../context/JamContext';

export const JamModal: React.FC = () => {
  const {
    jamId,
    isJamActive,
    isHost,
    participants,
    createJam,
    joinJam,
    leaveJam,
    sendReaction,
    isJamModalOpen,
    setIsJamModalOpen
  } = useJam();

  const [inputCode, setInputCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isJamModalOpen) return null;

  const handleCreate = async () => {
    setIsCreating(true);
    setErrorMsg(null);
    try {
      await createJam();
    } catch {
      setErrorMsg('Failed to create Jam. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setErrorMsg(null);
    try {
      const ok = await joinJam(inputCode);
      if (!ok) {
        setErrorMsg('Jam session not found. Check the code.');
      } else {
        setInputCode('');
      }
    } catch {
      setErrorMsg('Could not join Jam.');
    }
  };

  const shareUrl = jamId
    ? `${window.location.origin}/?jam=${jamId}`
    : '';

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    if (!jamId) return;
    navigator.clipboard.writeText(jamId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-6 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-[#1ed760]/20 text-[#1ed760]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                Tides Jam
                {isJamActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1ed760] text-black font-extrabold uppercase">
                    Live
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">Listen together in real-time</p>
            </div>
          </div>

          <button
            onClick={() => setIsJamModalOpen(false)}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 1. ACTIVE JAM VIEW */}
        {isJamActive && jamId ? (
          <div className="space-y-6">
            {/* Jam Code & Share Pill */}
            <div className="p-4 bg-gradient-to-r from-emerald-950/40 to-black/60 rounded-2xl border border-[#1ed760]/20 flex flex-col items-center text-center space-y-2">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Jam Session Code</span>
              <div className="text-3xl font-black tracking-widest text-[#1ed760] font-mono">
                {jamId}
              </div>

              <div className="flex items-center gap-2 pt-2 w-full">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white text-black font-bold text-xs rounded-full hover:scale-102 active:scale-98 transition shadow"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
                </button>

                <button
                  onClick={copyCode}
                  className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-full transition"
                  title="Copy 5-letter Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-[#1ed760]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Active Listeners List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-1">
                <span>Listeners ({participants.length})</span>
                <span className="text-[11px] text-[#1ed760] flex items-center gap-1 font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-ping" />
                  Synced
                </span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {participants.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center font-black text-xs text-black">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          {p.name}
                          {p.is_host && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded font-bold">
                              <Crown className="w-3 h-3" /> Host
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Animated Equalizer Wave */}
                    <div className="flex items-end gap-0.5 h-3.5 w-3">
                      <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.75 bg-[#1ed760] rounded-full animate-bounce h-5/6" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Live Reactions Bar */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-zinc-400 px-1">Send Instant Reaction</span>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded-2xl border border-white/5">
                {[
                  { emoji: '🔥', label: 'Fire' },
                  { emoji: '❤️', label: 'Heart' },
                  { emoji: '🎵', label: 'Vibe' },
                  { emoji: '👏', label: 'Clap' },
                  { emoji: '🥳', label: 'Party' }
                ].map(item => (
                  <button
                    key={item.emoji}
                    onClick={() => sendReaction(item.emoji)}
                    className="p-2 text-xl hover:scale-130 active:scale-95 transition-transform rounded-xl hover:bg-white/10"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave / End Jam Button */}
            <div className="pt-2">
              <button
                onClick={leaveJam}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition border border-red-500/20"
              >
                <UserMinus className="w-4 h-4" />
                <span>{isHost ? 'End Jam Session' : 'Leave Jam'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* 2. START OR JOIN JAM VIEW */
          <div className="space-y-5">
            {/* Start a Jam Card */}
            <div className="p-5 bg-gradient-to-br from-[#1ed760]/10 via-black to-[#1ed760]/5 border border-[#1ed760]/20 rounded-2xl space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1ed760]" />
                  Start a Live Jam
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Invite a friend to listen in real-time. Whoever pauses, skips, or plays seeks for both listeners simultaneously!
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full py-2.5 px-4 bg-[#1ed760] hover:bg-[#1fdf64] active:scale-98 text-black font-extrabold text-sm rounded-full transition shadow-[0_0_20px_rgba(30,215,96,0.3)] flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>{isCreating ? 'Creating Session...' : 'Start a Jam'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Join an Existing Jam */}
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Join a Friend's Jam</label>
                <input
                  type="text"
                  placeholder="Paste Jam link or code (e.g. JAM-8A3B1)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-[#1ed760] uppercase placeholder:normal-case font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 active:scale-98 text-white font-bold text-sm rounded-full transition"
              >
                Join Jam
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
