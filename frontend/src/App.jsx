import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Music, Camera, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import MapView from './components/MapView';
import PinsManager from './components/PinsManager';
import MusicManager from './components/MusicManager';
import MediaManager from './components/MediaManager';
import AlbumPage from './components/AlbumPage';
import { usePins, useMusic, usePhotos } from './hooks/usePhotos';
import { useSocket } from './hooks/useSocket';
import { pinsApi } from './services/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'pins',  label: 'Pins',  icon: MapPin,  color: '#6366f1' },
  { id: 'music', label: 'Music', icon: Music,   color: '#a855f7' },
  { id: 'media', label: 'Media', icon: Camera,  color: '#06b6d4' },
];

export default function App() {
  const { pins, loading: pinsLoading, refetch: refetchPins } = usePins();
  const { music, refetch: refetchMusic } = useMusic();
  const { photos, refetch: refetchPhotos } = usePhotos();

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
  const [selectedPin, setSelectedPin] = useState(null); // For gorgeous popup
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
    setSelectedPin(pin);
  }, []);

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
        <button onClick={() => setSidebarOpen(s => !s)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
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
          <MapView
            pins={pins}
            pinsLoading={pinsLoading}
            isPlacingPin={isPlacingPin}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            flyToLocation={flyToLocation}
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
            onClose={() => setSelectedPin(null)}
            onNavigatePin={(p) => setSelectedPin(p)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
