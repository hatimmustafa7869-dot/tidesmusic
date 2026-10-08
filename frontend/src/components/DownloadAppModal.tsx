import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  HelpCircle,
  Laptop,
  Share2,
  Smartphone,
  X
} from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'pc' | 'ios'>('android');

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on your PC, look at the top-right of your browser address bar and click the "Install app" icon (computer monitor with down arrow), or click the 3 dots (⋮) > "Install Tides Music".');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#181818] border border-[#2e2e2e] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-[#282828] transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-gradient-to-b from-[#11243d] to-[#181818] border-b border-white/5 flex flex-col items-center text-center">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-[#1ed760] rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
            <img
              src="/logo.png"
              alt="Tides Music"
              className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-2xl border border-white/10"
            />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Get the Tides Music App
          </h2>
          {isInstalled && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1ed760]/20 text-[#1ed760] text-xs font-bold mt-2">
              <Check className="w-3.5 h-3.5" /> Installed on this device
            </span>
          )}
          <p className="text-xs md:text-sm text-zinc-400 max-w-md mt-1.5">
            Stream unlimited music with background playback, lockscreen controls, and offline listening on phone and PC.
          </p>

          {/* Platform Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-[#121212] p-1 rounded-full border border-white/10 mt-6 shadow-inner">
            <button
              onClick={() => setActiveTab('android')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${
                activeTab === 'android'
                  ? 'bg-[#1ed760] text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Android (APK)</span>
            </button>

            <button
              onClick={() => setActiveTab('pc')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${
                activeTab === 'pc'
                  ? 'bg-white text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>PC / Windows</span>
            </button>

            <button
              onClick={() => setActiveTab('ios')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition ${
                activeTab === 'ios'
                  ? 'bg-[#3b82f6] text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>iPhone (iOS)</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              {/* PRIMARY: Official Native APK */}
              <div className="bg-gradient-to-r from-[#1b2b1e] to-[#202020] border border-[#1ed760]/30 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-5 shadow-lg">
                <div className="space-y-1.5 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760] text-black px-2.5 py-0.5 rounded-full">
                      Official Android App (APK)
                    </span>
                    <span className="text-xs text-[#1ed760] font-semibold">Recommended for Phone</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Tides Music APK (True Background Playback)</h3>
                  <p className="text-xs text-zinc-300 max-w-sm">
                    Native Android app with an OS-level Foreground Audio Service. Music continues playing uninterrupted when your screen is locked or while using other apps.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                  <a
                    href="https://github.com/hatimmustafa7869-dot/tidesmusic/releases/download/v1.0.0/TidesMusic.apk"
                    download="TidesMusic.apk"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black font-extrabold text-sm rounded-full transition shadow-lg cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download APK (Direct)</span>
                  </a>
                  <button
                    onClick={handleInstallPWA}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-medium text-xs rounded-full transition text-center"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Or Install as Web App</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Installation Guide */}
              <div className="bg-[#1b1b1b] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <HelpCircle className="w-4 h-4 text-[#1ed760]" />
                  <span>How to install the APK on your Android phone:</span>
                </div>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside pt-1">
                  <li>Tap the green <strong>"Download APK (Direct)"</strong> button above.</li>
                  <li>When downloaded, open the notification or find <strong>TidesMusic.apk</strong> in your Downloads folder.</li>
                  <li>Tap <strong>"Install"</strong>. (If Android prompts, tap <em>Settings &gt; Allow from this source</em>).</li>
                  <li>Open Tides Music — enjoy unlimited background music with lockscreen controls!</li>
                </ol>
                <div className="pt-2.5 border-t border-white/5 text-[11px] text-zinc-400 bg-white/5 p-2.5 rounded-lg space-y-1">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <span>⚡ Why the APK is best for Android:</span>
                  </div>
                  <p>
                    Unlike mobile web browsers which freeze audio when your phone screen turns off, the Tides Music APK uses a native Android Foreground Audio Service that keeps the music playing smoothly without stopping.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PC / WINDOWS */}
          {activeTab === 'pc' && (
            <div className="space-y-4">
              <div className="bg-[#202020] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="space-y-1.5 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full">
                      Desktop App
                    </span>
                    <span className="text-xs text-zinc-400">Windows & Mac</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Tides Music for Desktop</h3>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    Dedicated desktop window with global keyboard media keys, system notifications, and instant taskbar launch.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={handleInstallPWA}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 hover:scale-105 active:scale-95 text-black font-extrabold text-sm rounded-full transition shadow-lg cursor-pointer"
                  >
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span>Install to PC (Instant)</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#1b1b1b] border border-white/5 rounded-xl p-4 space-y-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Check className="w-4 h-4 text-[#1ed760]" />
                  <span>How to install on Windows & Mac:</span>
                </div>
                <ol className="text-zinc-400 space-y-1.5 list-decimal list-inside">
                  <li>Click the white <strong>"Install to PC (Instant)"</strong> button above.</li>
                  <li>Or look at your browser's address bar in the top-right corner and click the <strong>Install App icon (computer monitor with down arrow)</strong>.</li>
                  <li>Click <strong>"Install"</strong>. Windows will create a desktop shortcut and open Tides Music in its own dedicated, native desktop window!</li>
                </ol>
                <div className="pt-2 border-t border-white/5 text-[11px] text-zinc-500">
                  ✨ Works with full keyboard media keys (Play/Pause/Next on keyboards and headsets) and taskbar pinning.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: iOS / iPHONE */}
          {activeTab === 'ios' && (
            <div className="bg-[#202020] border border-white/5 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install on iPhone & iPad</h3>
                  <p className="text-xs text-zinc-400">Install as a native full-screen app via Safari</p>
                </div>
              </div>

              <ol className="text-xs text-zinc-300 space-y-3 pt-2">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px] shrink-0">1</span>
                  <span>Open this website in <strong>Safari</strong> on your iPhone or iPad.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px] shrink-0">2</span>
                  <span>Tap the <strong>Share</strong> button at the bottom of the screen (the box with an arrow pointing up).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-[11px] shrink-0">3</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong>, then tap <strong>Add</strong> in the top right.</span>
                </li>
              </ol>

              <div className="pt-2 text-center">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#1ed760] font-semibold bg-[#1ed760]/10 px-3 py-1.5 rounded-full">
                  <Check className="w-3.5 h-3.5" />
                  Supports background lockscreen controls & Dynamic Island
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
