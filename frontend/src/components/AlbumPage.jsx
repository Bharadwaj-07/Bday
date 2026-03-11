import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, ChevronLeft, ChevronRight,
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Camera, Music, Maximize2, Minimize2, Sparkles, Navigation,
  Repeat, Shuffle,
} from 'lucide-react';
import { photosApi, musicApi } from '../services/api';

// ── Haversine distance in km ────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Build nearest-neighbor ordered list of pins ─────────────────────────────
function buildNearestRoute(pins, startPin) {
  if (!pins.length || !startPin) return [startPin].filter(Boolean);
  const remaining = pins.filter(p => p._id !== startPin._id);
  const route = [startPin];
  let current = startPin;
  while (remaining.length) {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    current = remaining.splice(nearest, 1)[0];
    route.push(current);
  }
  return route;
}

// ── Format seconds to mm:ss ─────────────────────────────────────────────────
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════════════
// ALBUM PAGE — Full-screen immersive album for a pin
// ════════════════════════════════════════════════════════════════════════════════
export default function AlbumPage({ pin, allPins, onClose, onNavigatePin }) {
  // ── Media state ───────────────────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState([]);     // full photo/video docs
  const [musicItems, setMusicItems] = useState([]);     // { _id, originalName }
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const slideshowTimerRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  // ── Audio state ───────────────────────────────────────────────────────────
  const [currentTrack, setCurrentTrack] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoop, setAudioLoop] = useState(true);
  const audioRef = useRef(null);

  // ── Pin route (nearest-distance ordered) ──────────────────────────────────
  const route = useMemo(() => buildNearestRoute(allPins, pin), [allPins, pin]);
  const routeIdx = useMemo(() => route.findIndex(p => p._id === pin._id), [route, pin]);

  const hasPrevPin = routeIdx > 0;
  const hasNextPin = routeIdx < route.length - 1;

  const goPrevPin = useCallback(() => {
    if (hasPrevPin) onNavigatePin(route[routeIdx - 1]);
  }, [hasPrevPin, route, routeIdx, onNavigatePin]);

  const goNextPin = useCallback(() => {
    if (hasNextPin) onNavigatePin(route[routeIdx + 1]);
  }, [hasNextPin, route, routeIdx, onNavigatePin]);

  // ── Load linked media & music ─────────────────────────────────────────────
  useEffect(() => {
    if (!pin) return;
    setLoadingMedia(true);
    setCurrentIdx(0);
    setSlideshowActive(false);

    const loadMedia = async () => {
      if (!pin.photoIds?.length) { setMediaItems([]); setLoadingMedia(false); return; }
      const results = await Promise.all(
        pin.photoIds.map(id => photosApi.getOne(id).then(r => r.data).catch(() => null))
      );
      setMediaItems(results.filter(Boolean));
      setLoadingMedia(false);
    };

    const loadMusic = async () => {
      if (!pin.musicIds?.length) { setMusicItems([]); return; }
      // Build list — we can fetch names from the music API
      try {
        const { data } = await musicApi.getAll();
        const allMusic = data.music || [];
        const linked = pin.musicIds
          .map(id => allMusic.find(m => m._id === id))
          .filter(Boolean);
        setMusicItems(linked);
      } catch {
        setMusicItems(pin.musicIds.map(id => ({ _id: id, originalName: 'Track' })));
      }
    };

    loadMedia();
    loadMusic();
  }, [pin]);

  // ── Auto-start music when page opens ──────────────────────────────────────
  useEffect(() => {
    if (musicItems.length > 0 && !audioPlaying) {
      setCurrentTrack(0);
      setAudioPlaying(true);
    }
  }, [musicItems]);

  // ── Audio playback ────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicItems.length) return;
    audio.src = musicApi.fileUrl(musicItems[currentTrack]?._id);
    audio.muted = audioMuted;
    if (audioPlaying) audio.play().catch(() => {});
  }, [currentTrack, musicItems]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [audioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = audioMuted;
  }, [audioMuted]);

  const handleAudioTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setAudioProgress(a.currentTime);
    setAudioDuration(a.duration || 0);
  }, []);

  const handleAudioEnded = useCallback(() => {
    if (musicItems.length <= 1 && audioLoop) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    const next = (currentTrack + 1) % musicItems.length;
    if (next === 0 && !audioLoop) {
      setAudioPlaying(false);
      return;
    }
    setCurrentTrack(next);
  }, [currentTrack, musicItems.length, audioLoop]);

  const seekAudio = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current && audioDuration) {
      audioRef.current.currentTime = ratio * audioDuration;
    }
  }, [audioDuration]);

  // ── Current media item ────────────────────────────────────────────────────
  const currentMedia = mediaItems[currentIdx] || null;
  const isVideo = currentMedia?.mediaType === 'video' ||
                  currentMedia?.mimeType?.startsWith('video/');
  const mediaUrl = currentMedia ? photosApi.fileUrl(currentMedia._id) : null;

  // ── Slideshow timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);
    if (!slideshowActive || mediaItems.length <= 1) return;

    slideshowTimerRef.current = setInterval(() => {
      // Don't advance if the current item is a video (let video finish)
      if (isVideo && videoRef.current && !videoRef.current.ended) return;
      setCurrentIdx(i => (i + 1) % mediaItems.length);
    }, 5000);

    return () => clearInterval(slideshowTimerRef.current);
  }, [slideshowActive, mediaItems.length, isVideo]);

  // When a video ends during slideshow, advance
  const handleVideoEnded = useCallback(() => {
    if (slideshowActive && mediaItems.length > 1) {
      setCurrentIdx(i => (i + 1) % mediaItems.length);
    }
  }, [slideshowActive, mediaItems.length]);

  // Auto-play videos when they become current
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentIdx, isVideo]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNextMedia = useCallback(() => {
    setCurrentIdx(i => (i + 1) % Math.max(mediaItems.length, 1));
  }, [mediaItems.length]);

  const goPrevMedia = useCallback(() => {
    setCurrentIdx(i => (i - 1 + Math.max(mediaItems.length, 1)) % Math.max(mediaItems.length, 1));
  }, [mediaItems.length]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { if (fullscreen) document.exitFullscreen(); else onClose(); }
      if (e.key === 'ArrowLeft') goPrevMedia();
      if (e.key === 'ArrowRight') goNextMedia();
      if (e.key === ' ') { e.preventDefault(); setSlideshowActive(s => !s); }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'ArrowUp' && hasPrevPin) goPrevPin();
      if (e.key === 'ArrowDown' && hasNextPin) goNextPin();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrevMedia, goNextMedia, toggleFullscreen, fullscreen, hasPrevPin, hasNextPin, goPrevPin, goNextPin]);

  if (!pin) return null;

  const pinColor = pin.color || '#6366f1';
  const distToNext = hasNextPin
    ? haversine(pin.lat, pin.lng, route[routeIdx + 1].lat, route[routeIdx + 1].lng).toFixed(1)
    : null;
  const distToPrev = hasPrevPin
    ? haversine(pin.lat, pin.lng, route[routeIdx - 1].lat, route[routeIdx - 1].lng).toFixed(1)
    : null;

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[5000] flex flex-col album-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: '#07080c' }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        preload="auto"
      />

      {/* ══════ TOP BAR ══════════════════════════════════════════════════════ */}
      <div className="album-topbar relative z-20 shrink-0 flex items-center justify-between px-5 py-3"
        style={{ background: 'linear-gradient(180deg, rgba(7,8,12,0.95) 0%, rgba(7,8,12,0.6) 100%)' }}>

        {/* Left: Back + Pin info */}
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.1]
                       border border-white/[0.08] hover:border-white/[0.15] transition-all">
            <ArrowLeft size={16} />
            <span>Back to Map</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${pinColor}25`, border: `1px solid ${pinColor}40` }}>
              <MapPin size={18} style={{ color: pinColor }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{pin.name}</h1>
              {pin.description && (
                <p className="text-xs text-white/40 max-w-xs truncate">{pin.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Center: Media counter */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">
            <Camera size={12} className="text-cyan-400" />
            {mediaItems.length} media
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">
            <Music size={12} className="text-purple-400" />
            {musicItems.length} song{musicItems.length !== 1 ? 's' : ''}
          </span>
          <span className="text-white/25 font-mono">
            {pin.lat?.toFixed(4)}°, {pin.lng?.toFixed(4)}°
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <button onClick={toggleFullscreen}
            className="p-2.5 rounded-xl text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]
                       border border-white/[0.06] transition-all"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* ══════ MAIN CONTENT ═════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-stretch overflow-hidden relative">

        {/* ── Prev Pin Nav (left edge) ───────────────────────────────────── */}
        {hasPrevPin && (
          <button onClick={goPrevPin}
            className="album-pin-nav absolute left-0 top-0 bottom-0 w-16 z-30
                       flex flex-col items-center justify-center gap-1
                       text-white/20 hover:text-white/70 transition-all group"
            style={{ background: 'linear-gradient(90deg, rgba(7,8,12,0.8) 0%, transparent 100%)' }}
            title={`Previous: ${route[routeIdx - 1]?.name} (${distToPrev} km)`}>
            <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity writing-mode-vertical">
              {route[routeIdx - 1]?.name}
            </span>
            <span className="text-[8px] opacity-0 group-hover:opacity-70 transition-opacity">{distToPrev}km</span>
          </button>
        )}

        {/* ── Next Pin Nav (right edge) ──────────────────────────────────── */}
        {hasNextPin && (
          <button onClick={goNextPin}
            className="album-pin-nav absolute right-0 top-0 bottom-0 w-16 z-30
                       flex flex-col items-center justify-center gap-1
                       text-white/20 hover:text-white/70 transition-all group"
            style={{ background: 'linear-gradient(-90deg, rgba(7,8,12,0.8) 0%, transparent 100%)' }}
            title={`Next: ${route[routeIdx + 1]?.name} (${distToNext} km)`}>
            <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform" />
            <span className="text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity writing-mode-vertical">
              {route[routeIdx + 1]?.name}
            </span>
            <span className="text-[8px] opacity-0 group-hover:opacity-70 transition-opacity">{distToNext}km</span>
          </button>
        )}

        {/* ── Slideshow Area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center relative px-20">

          {loadingMedia ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-accent animate-spin" />
              <p className="text-sm text-white/30">Loading album…</p>
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{ background: `${pinColor}15`, border: `2px solid ${pinColor}25` }}>
                <Camera size={40} style={{ color: pinColor }} strokeWidth={1} />
              </div>
              <p className="text-white/40 text-lg font-medium">No photos or videos linked</p>
              <p className="text-white/20 text-sm">Link media to this pin from the sidebar</p>
            </div>
          ) : (
            <>
              {/* Background blur of current media */}
              <div className="absolute inset-0 overflow-hidden">
                {!isVideo && mediaUrl && (
                  <img src={mediaUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-15 scale-125" />
                )}
                <div className="absolute inset-0 bg-[#07080c]/70" />
              </div>

              {/* Media display */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMedia?._id || currentIdx}
                  className="relative z-10 flex items-center justify-center w-full h-full"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                  {isVideo ? (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      className="max-w-full max-h-full rounded-2xl shadow-2xl album-media"
                      controls
                      autoPlay
                      onEnded={handleVideoEnded}
                      style={{ maxHeight: 'calc(100vh - 200px)' }}
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={currentMedia?.title || currentMedia?.originalName || ''}
                      className="max-w-full max-h-full rounded-2xl shadow-2xl album-media object-contain"
                      style={{ maxHeight: 'calc(100vh - 200px)' }}
                      draggable={false}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Media info overlay (bottom of slideshow) */}
              {currentMedia && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20
                                flex items-center gap-3 px-5 py-2.5 rounded-2xl
                                bg-black/60 backdrop-blur-xl border border-white/[0.06]">
                  <span className="text-xs text-white/70 font-medium">
                    {currentMedia.title || currentMedia.originalName}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {currentIdx + 1} / {mediaItems.length}
                  </span>
                  {isVideo && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      VIDEO
                    </span>
                  )}
                </div>
              )}

              {/* Media prev/next arrows */}
              {mediaItems.length > 1 && (
                <>
                  <button onClick={goPrevMedia}
                    className="absolute left-24 top-1/2 -translate-y-1/2 z-20
                               p-3 rounded-2xl bg-black/40 backdrop-blur-md
                               text-white/50 hover:text-white border border-white/[0.08] hover:border-white/[0.2]
                               transition-all hover:scale-105">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={goNextMedia}
                    className="absolute right-24 top-1/2 -translate-y-1/2 z-20
                               p-3 rounded-2xl bg-black/40 backdrop-blur-md
                               text-white/50 hover:text-white border border-white/[0.08] hover:border-white/[0.2]
                               transition-all hover:scale-105">
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════ BOTTOM BAR ═══════════════════════════════════════════════════ */}
      <div className="album-bottombar relative z-20 shrink-0"
        style={{ background: 'linear-gradient(0deg, rgba(7,8,12,0.98) 0%, rgba(7,8,12,0.7) 100%)' }}>

        {/* Thumbnail strip + slideshow controls */}
        {mediaItems.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 border-b border-white/[0.04]">
            {/* Slideshow toggle */}
            <button onClick={() => setSlideshowActive(s => !s)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                slideshowActive
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:text-white hover:bg-white/[0.08]'
              }`}>
              {slideshowActive ? <Pause size={12} /> : <Play size={12} />}
              {slideshowActive ? 'Pause' : 'Slideshow'}
            </button>

            {/* Thumbnail strip */}
            <div className="flex-1 overflow-x-auto flex gap-1.5 py-1 album-thumbstrip">
              {mediaItems.map((item, i) => {
                const thumbIsVideo = item.mediaType === 'video' || item.mimeType?.startsWith('video/');
                return (
                  <button key={item._id} onClick={() => setCurrentIdx(i)}
                    className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all relative ${
                      i === currentIdx
                        ? 'border-white/70 ring-1 ring-accent/40 scale-105'
                        : 'border-transparent opacity-40 hover:opacity-70'
                    }`}>
                    {thumbIsVideo ? (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <Play size={14} className="text-white/60" />
                      </div>
                    ) : (
                      <img src={photosApi.fileUrl(item._id)} alt=""
                        className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Audio playlist player */}
        {musicItems.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-3">
            {/* Play/Pause */}
            <button onClick={() => setAudioPlaying(p => !p)}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={{
                background: audioPlaying ? pinColor : `${pinColor}30`,
                boxShadow: audioPlaying ? `0 4px 16px ${pinColor}40` : 'none',
              }}>
              {audioPlaying
                ? <Pause size={14} className="text-white" />
                : <Play size={14} className="text-white ml-0.5" />}
            </button>

            {/* Prev track */}
            <button onClick={() => setCurrentTrack(i => (i - 1 + musicItems.length) % musicItems.length)}
              className="p-2 rounded-lg text-white/30 hover:text-white transition-colors"
              disabled={musicItems.length <= 1}>
              <SkipBack size={14} />
            </button>

            {/* Track info + progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/70 font-medium truncate max-w-[200px]">
                  {musicItems[currentTrack]?.originalName?.replace(/\.[^/.]+$/, '') || `Track ${currentTrack + 1}`}
                </p>
                <span className="text-[10px] text-white/30 tabular-nums shrink-0 ml-2">
                  {formatTime(audioProgress)} / {formatTime(audioDuration)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] cursor-pointer group relative"
                onClick={seekAudio}>
                <div className="h-full rounded-full transition-all relative"
                  style={{
                    width: audioDuration ? `${(audioProgress / audioDuration) * 100}%` : '0%',
                    background: `linear-gradient(90deg, ${pinColor}, #a855f7)`,
                  }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white
                                  shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Track list (small) */}
              {musicItems.length > 1 && (
                <div className="flex gap-1 mt-1.5">
                  {musicItems.map((_, i) => (
                    <button key={i} onClick={() => setCurrentTrack(i)}
                      className={`h-1 rounded-full transition-all ${
                        i === currentTrack ? 'w-4 bg-white/60' : 'w-1.5 bg-white/15 hover:bg-white/30'
                      }`} />
                  ))}
                </div>
              )}
            </div>

            {/* Next track */}
            <button onClick={() => setCurrentTrack(i => (i + 1) % musicItems.length)}
              className="p-2 rounded-lg text-white/30 hover:text-white transition-colors"
              disabled={musicItems.length <= 1}>
              <SkipForward size={14} />
            </button>

            {/* Loop toggle */}
            <button onClick={() => setAudioLoop(l => !l)}
              className={`p-2 rounded-lg transition-colors ${audioLoop ? 'text-accent' : 'text-white/20 hover:text-white/50'}`}
              title={audioLoop ? 'Loop on' : 'Loop off'}>
              <Repeat size={14} />
            </button>

            {/* Mute toggle */}
            <button onClick={() => setAudioMuted(m => !m)}
              className="p-2 rounded-lg text-white/30 hover:text-white transition-colors">
              {audioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        )}

        {/* Pin route bar */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Navigation size={12} className="text-white/25" />
            <span className="text-[10px] text-white/30 font-medium">
              Stop {routeIdx + 1} of {route.length}
            </span>
          </div>
          {/* Mini route dots */}
          <div className="flex items-center gap-1">
            {route.map((p, i) => (
              <button
                key={p._id}
                onClick={() => onNavigatePin(p)}
                className={`rounded-full transition-all ${
                  i === routeIdx
                    ? 'w-5 h-2 bg-white/60'
                    : 'w-2 h-2 bg-white/15 hover:bg-white/30'
                }`}
                title={p.name}
                style={i === routeIdx ? { background: pinColor } : undefined}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/25">
            <span>← → media</span>
            <span>↑ ↓ pins</span>
            <span>Space slideshow</span>
            <span>F fullscreen</span>
          </div>
        </div>
      </div>

      {/* Ambient glow behind content */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px]"
          style={{ background: pinColor }} />
      </div>
    </motion.div>
  );
}
