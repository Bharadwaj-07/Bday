import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Music, Camera, PanelLeftClose, PanelLeftOpen, Sparkles, Play, Pause, SkipBack, SkipForward, LogOut, ShieldCheck } from 'lucide-react';
import MapView from './components/MapView';
import PinsManager from './components/PinsManager';
import MusicManager from './components/MusicManager';
import MediaManager from './components/MediaManager';
import AlbumPage from './components/AlbumPage';
import { usePins, useMusic, usePhotos } from './hooks/usePhotos';
import { useSocket } from './hooks/useSocket';
import { pinsApi, musicApi, authApi, getStoredUser, setStoredUser, clearStoredUser, getStoredUserId, setStoredUserId, clearStoredUserId } from './services/api';
import { fetchProtectedMediaUrl } from './components/ProtectedMedia';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'pins',  label: 'Pins',  icon: MapPin,  color: '#6366f1' },
  { id: 'music', label: 'Music', icon: Music,   color: '#a855f7' },
  { id: 'media', label: 'Media', icon: Camera,  color: '#06b6d4' },
];

const normalizeId = (value) => value && typeof value === 'object' && value.toString ? value.toString() : String(value ?? '');

function GoogleAuthScreen({ onAuthenticated }) {
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthError('Google login is not configured. Set VITE_GOOGLE_CLIENT_ID in the frontend environment.');
      setIsLoading(false);
      return;
    }

    const scriptId = 'google-identity-script';
    const existing = document.getElementById(scriptId);

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        setAuthError('Google Identity Services failed to load.');
        setIsLoading(false);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            setIsLoading(true);
            const { data } = await authApi.googleLogin(response.credential);
            const user = data.user || null;
            if (user) {
              setStoredUser(user);
              setStoredUserId(user._id);
            }
            onAuthenticated(user);
          } catch (err) {
            setAuthError(err.message || 'Google login failed.');
            setIsLoading(false);
          }
        },
      });

      window.google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
      });

      setIsLoading(false);
    };

    if (existing) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      setAuthError('Google script failed to load.');
      setIsLoading(false);
    };
    document.body.appendChild(script);
  }, [onAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-violet-300">PhotoMap</div>
            <h1 className="text-2xl font-bold text-white">Sign in</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-300">
          Continue with Google to load your pins, media, and music securely.
        </p>

        {authError ? (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {authError}
          </div>
        ) : null}

        <div id="google-signin-button" className="flex justify-center min-h-[44px]" />

        {isLoading && (
          <div className="mt-4 text-center text-xs text-slate-400">Loading Google sign in…</div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const restoreSession = useCallback(() => {
    const user = getStoredUser();

    if (!user || !user._id) {
      clearStoredUser();
      setAuthUser(null);
      setAuthReady(true);
      return;
    }

    setStoredUserId(user._id);
    setAuthUser(user);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    restoreSession();
    const onLogout = () => {
      clearStoredUser();
      setAuthUser(null);
      setAuthReady(true);
    };
    window.addEventListener('photomap:logout', onLogout);
    return () => window.removeEventListener('photomap:logout', onLogout);
  }, [restoreSession]);

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading…</div>;
  }

  if (!authUser) {
    return <GoogleAuthScreen onAuthenticated={setAuthUser} />;
  }

  return <AuthenticatedApp user={authUser} onLogout={() => {
    clearStoredUser();
    setAuthUser(null);
  }} />;
}

function AuthenticatedApp({ user, onLogout }) {
  const { pins, loading: pinsLoading, refetch: refetchPins } = usePins();
  const { music, refetch: refetchMusic } = useMusic();
  const { photos, refetch: refetchPhotos } = usePhotos();
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [selectedPin, setSelectedPin] = useState(null); // For gorgeous popup
  const [playbackOpenDelay, setPlaybackOpenDelay] = useState(false);
  const audioRef = useRef(null);

  const playbackPins = useMemo(() => pins || [], [pins]);

  const currentPlaybackPin = playbackPins[playbackIndex % Math.max(playbackPins.length, 1)] || null;
  const playbackMusic = useMemo(() => {
    if (!currentPlaybackPin?.musicIds?.length) return [];
    const linkedIds = (currentPlaybackPin.musicIds || []).slice(0, 1).map(normalizeId);
    const ids = new Set(linkedIds);
    return (music || []).filter(song => ids.has(normalizeId(song._id)));
  }, [currentPlaybackPin, music]);

  useEffect(() => {
    if (!playbackPins.length) {
      setPlaybackIndex(0);
      return;
    }
    if (!selectedPin) {
      setPlaybackIndex(0);
      return;
    }
    const selectedIndex = playbackPins.findIndex(pin => pin._id === selectedPin._id);
    if (selectedIndex >= 0) {
      setPlaybackIndex(selectedIndex);
    }
  }, [selectedPin, playbackPins]);

  useEffect(() => {
    if (!playbackPins.length || !currentPlaybackPin) return;
    setFlyToLocation({ lat: currentPlaybackPin.lat, lng: currentPlaybackPin.lng, ts: Date.now() });
  }, [currentPlaybackPin, playbackPins.length]);

  // Route playback should only move through the pin list; it should NOT open the album viewer.
  useEffect(() => {
    if (!isPlaybackPlaying || !playbackPins.length) return;
    const timer = setTimeout(() => {
      setPlaybackIndex(index => (index + 1) % playbackPins.length);
    }, 7000);
    return () => clearTimeout(timer);
  }, [isPlaybackPlaying, playbackIndex, playbackPins.length]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const el = audioRef.current;
    if (!el || !isPlaybackPlaying || !playbackMusic.length) {
      el?.pause();
      return;
    }

    const song = playbackMusic[0];
    const protectedUrl = musicApi.fileUrl(song._id);

    fetchProtectedMediaUrl(protectedUrl)
      .then((url) => {
        if (!active || !el) return;
        if (el.dataset.protectedAudioUrl && el.dataset.protectedAudioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(el.dataset.protectedAudioUrl);
        }
        objectUrl = url;
        el.dataset.protectedAudioUrl = url;
        el.src = url;
        el.play().catch(() => {});
      })
      .catch(() => {
        if (active && el) {
          el.src = '';
          el.pause();
        }
      });

    return () => {
      active = false;
      if (objectUrl && objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
      if (el?.dataset.protectedAudioUrl && el.dataset.protectedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(el.dataset.protectedAudioUrl);
      }
      delete el?.dataset.protectedAudioUrl;
    };
  }, [isPlaybackPlaying, playbackMusic]);

  const goPrevPlayback = useCallback(() => {
    if (!playbackPins.length) return;
    const nextIndex = (playbackIndex - 1 + playbackPins.length) % playbackPins.length;
    setPlaybackIndex(nextIndex);
    setPlaybackOpenDelay(false);
  }, [playbackIndex, playbackPins]);

  const goNextPlayback = useCallback(() => {
    if (!playbackPins.length) return;
    const nextIndex = (playbackIndex + 1) % playbackPins.length;
    setPlaybackIndex(nextIndex);
    setPlaybackOpenDelay(false);
  }, [playbackIndex, playbackPins]);

  // ── Socket real-time ──────────────────────────────────────────────────────
  useSocket({
    onPhotoAdded:   () => refetchPhotos(),
    onPhotoUpdated: () => refetchPhotos(),
    onPhotoDeleted: () => refetchPhotos(),
    onPinAdded:     () => refetchPins(),
    onPinUpdated:   () => refetchPins(),
    onPinDeleted:   () => refetchPins(),
    onMusicAdded:   () => refetchMusic(),
    onMusicDeleted: () => refetchMusic(),
  });

  // ── UI State ──────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('pins');
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPinData, setPendingPinData] = useState(null); // { name, color }
  const [flyToLocation, setFlyToLocation] = useState(null); // For sidebar fly-to

  // ── Pin placement flow ────────────────────────────────────────────────────
  const handleStartPlacing = useCallback((pinData) => {
    setPendingPinData(pinData);
    setIsPlacingPin(true);
  }, []);

  const handleMapClick = useCallback(async (lat, lng) => {
    if (!isPlacingPin || !pendingPinData) return;
    setIsPlacingPin(false);
    try {
      await pinsApi.create({ ...pendingPinData, lat, lng });
      toast.success(`Pin "${pendingPinData.name}" dropped!`);
      refetchPins();
    } catch (err) {
      toast.error(err.message);
    }
    setPendingPinData(null);
  }, [isPlacingPin, pendingPinData, refetchPins]);

  const handlePinClick = useCallback((pin) => {
    setIsPlaybackPlaying(false);
    setPlaybackOpenDelay(false);
    const pinIndex = playbackPins.findIndex(item => item._id === pin._id);
    if (pinIndex >= 0) setPlaybackIndex(pinIndex);
    setSelectedPin(pin);
  }, [playbackPins]);

  const handleRouteAutoAdvance = useCallback(() => {
    if (!isPlaybackPlaying || !playbackPins.length) return;
    const nextIndex = (playbackIndex + 1) % playbackPins.length;
    setPlaybackIndex(nextIndex);
    setPlaybackOpenDelay(false);
    setSelectedPin(playbackPins[nextIndex]);
  }, [isPlaybackPlaying, playbackIndex, playbackPins]);

  const handleFlyToPin = useCallback((pin) => {
    setFlyToLocation({ lat: pin.lat, lng: pin.lng, ts: Date.now() });
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="glass z-[900] flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none text-white">PhotoMap</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Memory Explorer</p>
            </div>
          </div>
          <span className="hidden sm:flex text-xs text-slate-500 bg-surface-hover px-2 py-0.5 rounded-full border border-surface-border">
            {pins.length} pin{pins.length !== 1 ? 's' : ''} · {photos.length} media · {music.length} song{music.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 sm:flex">
            <ShieldCheck size={12} />
            {user.email}
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-hover px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white"
          >
            <LogOut size={14} />
            Logout
          </button>
          <button onClick={() => setSidebarOpen(s => !s)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className={`flex-1 relative ${isPlacingPin ? 'map-placing-mode' : ''}`}>
          {isPlacingPin && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
                            glass px-5 py-2.5 rounded-full text-sm font-medium
                            text-amber-300 border border-amber-400/30 bg-amber-500/10
                            animate-pulse pointer-events-none flex items-center gap-2">
              <MapPin size={14} />
              Click anywhere on the map to place "{pendingPinData?.name}"
            </div>
          )}

          <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-full border border-surface-border bg-surface-card/80 px-3 py-2 shadow-lg backdrop-blur-md">
            <button
              onClick={goPrevPlayback}
              disabled={!playbackPins.length}
              className="rounded-full p-2 text-slate-300 hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous pin"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={() => {
              if (isPlaybackPlaying) {
                setIsPlaybackPlaying(false);
                setPlaybackOpenDelay(false);
                return;
              }
              setPlaybackIndex(0);
              setPlaybackOpenDelay(false);
              setIsPlaybackPlaying(true);
            }}
              disabled={!playbackPins.length}
              className="rounded-full bg-accent p-2.5 text-white shadow-lg hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
              title={isPlaybackPlaying ? 'Pause route' : 'Play route'}
            >
              {isPlaybackPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <button
              onClick={goNextPlayback}
              disabled={!playbackPins.length}
              className="rounded-full p-2 text-slate-300 hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Next pin"
            >
              <SkipForward size={16} />
            </button>
            <div className="ml-1 min-w-[120px] border-l border-surface-border pl-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Route</p>
              <p className="text-xs text-white truncate max-w-[160px]">
                {currentPlaybackPin ? currentPlaybackPin.name : 'No pins'}
              </p>
            </div>
          </div>

          <audio ref={audioRef} onEnded={() => setIsPlaybackPlaying(false)} />

          <MapView
            pins={pins}
            pinsLoading={pinsLoading}
            isPlacingPin={isPlacingPin}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            flyToLocation={flyToLocation}
            focusPin={selectedPin}
            activePinId={currentPlaybackPin?._id || null}
          />
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="h-full border-l border-surface-border bg-surface-card overflow-hidden shrink-0"
            >
              <div className="w-[360px] h-full flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-surface-border shrink-0">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all relative ${
                        isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}>
                      <Icon size={14} style={isActive ? { color: tab.color } : undefined} />
                      <span>{tab.label}</span>
                      {isActive && (
                        <motion.div layoutId="tab-indicator"
                          className="absolute bottom-0 inset-x-2 h-0.5 rounded-full"
                          style={{ background: tab.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'pins' && (
                  <PinsManager
                    pins={pins}
                    onRefresh={refetchPins}
                    onStartPlacing={handleStartPlacing}
                    placingPin={isPlacingPin}
                    onFlyToPin={handleFlyToPin}
                  />
                )}
                {activeTab === 'music' && (
                  <MusicManager
                    music={music}
                    pins={pins}
                    onRefreshMusic={refetchMusic}
                    onRefreshPins={refetchPins}
                  />
                )}
                {activeTab === 'media' && (
                  <MediaManager
                    photos={photos}
                    pins={pins}
                    onRefreshPhotos={refetchPhotos}
                    onRefreshPins={refetchPins}
                  />
                )}
              </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── Full-page album view ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPin && (
          <AlbumPage
            key={selectedPin._id}
            pin={selectedPin}
            allPins={pins}
            autoAdvanceToNext={isPlaybackPlaying}
            onClose={() => {
              setIsPlaybackPlaying(false);
              setPlaybackOpenDelay(false);
              setSelectedPin(null);
            }}
            onNavigatePin={(p) => {
              setIsPlaybackPlaying(false);
              setPlaybackOpenDelay(false);
              setSelectedPin(p);
            }}
            onAutoAdvance={handleRouteAutoAdvance}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
