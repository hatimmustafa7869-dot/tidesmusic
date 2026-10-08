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
      alert('To install, open your browser menu (⋮ or ...) and tap "Install app" or "Add to Home screen".');
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
              <div className="bg-[#202020] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="space-y-1.5 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/20 text-[#1ed760] px-2.5 py-0.5 rounded-full">
                      Native Web App (PWA)
                    </span>
                    <span className="text-xs text-zinc-400">Android &bull; 0 Error Install</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Tides Music for Android</h3>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    Installs directly to your home screen & app drawer with lockscreen media controls, background audio, and instant updates.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={handleInstallPWA}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black font-extrabold text-sm rounded-full transition shadow-lg cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Install App on Phone</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Installation Guide */}
              <div className="bg-[#1b1b1b] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <HelpCircle className="w-4 h-4 text-[#1ed760]" />
                  <span>How to install on any Android phone (Chrome / Samsung / Brave)</span>
                </div>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside pt-1">
                  <li>Tap the green <strong>"Install App on Phone"</strong> button above.</li>
                  <li>Or tap the <strong>3 dots (⋮)</strong> in the top-right corner of Chrome / your mobile browser.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Confirm <strong>"Install"</strong>. Android will create the official app on your home screen with the Tides logo!</li>
                </ol>
                <div className="pt-2.5 border-t border-white/5 text-[11px] text-zinc-400 bg-white/5 p-2.5 rounded-lg space-y-1">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <span>⚡ Uninterrupted Background Playback on Android:</span>
                  </div>
                  <p>
                    Go to your phone's <strong>Settings &gt; Apps &gt; Chrome (or Tides Music) &gt; Battery</strong>, and set it to <strong>"Unrestricted"</strong> so Android doesn't pause the music when your screen is locked.
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
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 hover:scale-105 active:scale-95 text-black font-extrabold text-sm rounded-full transition shadow-lg"
                  >
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span>Install to PC (Instant)</span>
                  </button>

                  <a
                    href="/downloads/TidesMusic-Setup.exe"
                    download="TidesMusic-Setup.exe"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-full transition"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Download PC Installer (.exe)</span>
                  </a>
                </div>
              </div>

              <div className="bg-[#1b1b1b] border border-white/5 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#1ed760]" />
                  Why use Tides Desktop?
                </p>
                <p>
                  No tab clutter, instant lockscreen controls, and runs independently in its own ultra-fast window.
                </p>
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
