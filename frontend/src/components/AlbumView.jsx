import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Camera, Music, Edit3, Download,
  X, ChevronLeft, ChevronRight, Image as ImageIcon,
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Clock, Grid3X3,
} from 'lucide-react';
import { photosApi } from '../services/api';
import { useLocationPhotos } from '../hooks/usePhotos';

function exifDate(str) {
  if (!str) return null;
  try { return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return str; }
}

// ── Main AlbumView ─────────────────────────────────────────────────────────────
export default function AlbumView({ location, allPins = [], onClose, onOpenEdit, onNavigatePin }) {
  const { photos, loading } = useLocationPhotos(location?.lat, location?.lng);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const gridRef = useRef(null);

  // Find current pin index for prev/next navigation
  const pinIdx = useMemo(() => {
    if (!location || !allPins.length) return -1;
    return allPins.findIndex(p =>
      Math.abs(p.lat - location.lat) < 0.0001 && Math.abs(p.lng - location.lng) < 0.0001
    );
  }, [location, allPins]);
  const hasPrevPin = pinIdx > 0;
  const hasNextPin = pinIdx >= 0 && pinIdx < allPins.length - 1;
  const goPrevPin = useCallback(() => { if (hasPrevPin) onNavigatePin?.(allPins[pinIdx - 1]); }, [hasPrevPin, allPins, pinIdx, onNavigatePin]);
  const goNextPin = useCallback(() => { if (hasNextPin) onNavigatePin?.(allPins[pinIdx + 1]); }, [hasNextPin, allPins, pinIdx, onNavigatePin]);

  // Collect all songs from all photos at this location
  const allSongs = [];
  const songOwnerMap = {};
  for (const p of photos) {
    for (const s of (p.songs || [])) {
      allSongs.push(s);
      songOwnerMap[s._id] = p._id;
    }
  }

  // Hero photo = first photo
  const heroPhoto = photos[0] || null;
  const heroUrl = heroPhoto ? `/api/photos/${heroPhoto._id}/file` : null;

  // Keyboard: Escape closes lightbox or album
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') {
        if (lightboxIdx != null) setLightboxIdx(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, lightboxIdx]);

  const openLightbox = idx => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const prevPhoto = useCallback(() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1)), []);
  const nextPhoto = useCallback(() => setLightboxIdx(i => Math.min(photos.length - 1, (i ?? 0) + 1)), [photos.length]);

  // Keyboard nav in lightbox
  useEffect(() => {
    if (lightboxIdx == null) return;
    const handler = e => {
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, prevPhoto, nextPhoto]);

  const label = location?.label || `${location?.lat?.toFixed(4)}\u00B0, ${location?.lng?.toFixed(4)}\u00B0`;

  // Dates range
  const dates = photos
    .map(p => p.exif?.dateTaken ? new Date(p.exif.dateTaken) : null)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const dateRange = dates.length > 0
    ? dates.length === 1
      ? exifDate(dates[0].toISOString())
      : `${exifDate(dates[0].toISOString())} \u2014 ${exifDate(dates[dates.length - 1].toISOString())}`
    : null;

  return (
    <motion.div
      className="fixed inset-0 z-[2500] bg-[#0a0c14] flex flex-col overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Floating back button ────────────────────────────────────────── */}
      <div className="absolute top-5 left-5 z-50 flex items-center gap-2">
        <button onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/40 backdrop-blur-xl
                     border border-white/10 text-white/80 hover:text-white hover:bg-black/60
                     transition-all shadow-lg shadow-black/30">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* ── Pin navigation (floating top right) ─────────────────────────── */}
      {allPins.length > 1 && (
        <div className="absolute top-5 right-5 z-50 flex items-center gap-2">
          <button onClick={goPrevPin} disabled={!hasPrevPin}
            className="p-2.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10
                       text-white/70 hover:text-white hover:bg-black/60
                       disabled:opacity-20 disabled:cursor-default transition-all shadow-lg shadow-black/30">
            <ChevronLeft size={16} />
          </button>
          <div className="px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10
                          text-white/60 text-xs font-medium">
            {pinIdx + 1} / {allPins.length}
          </div>
          <button onClick={goNextPin} disabled={!hasNextPin}
            className="p-2.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10
                       text-white/70 hover:text-white hover:bg-black/60
                       disabled:opacity-20 disabled:cursor-default transition-all shadow-lg shadow-black/30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scroll-smooth" ref={gridRef}>
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-[3px] border-indigo-400 border-t-transparent animate-spin" />
              <span className="text-white/40 text-sm">Loading album...</span>
            </div>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-screen text-white/30 gap-4">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="text-lg">No photos at this location yet</p>
          </div>
        ) : (
          <>
            {/* ── Hero Section ───────────────────────────────────────── */}
            <div className="relative h-[65vh] min-h-[400px] overflow-hidden">
              {/* Background blur layer */}
              <div className="absolute inset-0 scale-110">
                {heroUrl && (
                  <img src={heroUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-40" draggable={false} />
                )}
              </div>
              {/* Hero image */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={() => openLightbox(0)}
                initial={{ scale: 1.05, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {heroUrl && (
                  <img
                    src={heroUrl}
                    alt={heroPhoto?.title || heroPhoto?.originalName}
                    className="max-h-full max-w-[90%] object-contain drop-shadow-2xl rounded-lg"
                    draggable={false}
                  />
                )}
              </motion.div>
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0a0c14] via-[#0a0c14]/80 to-transparent" />
              {/* Album info overlay */}
              <motion.div
                className="absolute bottom-0 inset-x-0 px-8 pb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 
                                       text-indigo-300 text-[10px] font-semibold uppercase tracking-wider">
                        Album
                      </span>
                      {allSongs.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/30
                                         text-purple-300 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                          <Music size={9} /> {allSongs.length} song{allSongs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight mb-2">
                      {label}
                    </h1>
                    <div className="flex items-center gap-4 text-white/50 text-sm">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-indigo-400" />
                        {location?.lat?.toFixed(5)}, {location?.lng?.toFixed(5)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Camera size={13} />
                        {photos.length} photo{photos.length !== 1 ? 's' : ''}
                      </span>
                      {dateRange && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {dateRange}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── Photo Grid Section ────────────────────────────────── */}
            <div className="px-6 md:px-8 pb-8">
              {/* Section header */}
              <div className="flex items-center gap-3 pt-6 pb-5">
                <Grid3X3 size={16} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white/90">All Photos</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>

              {/* Masonry-ish grid with varying sizes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 
                              gap-2 md:gap-3 auto-rows-[180px] md:auto-rows-[220px]">
                {photos.map((photo, idx) => {
                  const isTall = idx % 5 === 0 && idx > 0;
                  const isWide = idx % 7 === 3;

                  return (
                    <PhotoGridItem
                      key={photo._id}
                      photo={photo}
                      idx={idx}
                      isTall={isTall}
                      isWide={isWide}
                      onClick={() => openLightbox(idx)}
                      onOpenEdit={onOpenEdit}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Music Player Bar (sticky bottom) ────────────────────────────── */}
      {allSongs.length > 0 && (
        <AlbumMusicPlayer songs={allSongs} songOwnerMap={songOwnerMap} />
      )}

      {/* ── Lightbox overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxIdx != null && photos[lightboxIdx] && (
          <Lightbox
            photo={photos[lightboxIdx]}
            index={lightboxIdx}
            total={photos.length}
            onClose={closeLightbox}
            onPrev={prevPhoto}
            onNext={nextPhoto}
            onOpenEdit={onOpenEdit}
            allPhotos={photos}
            setLightboxIdx={setLightboxIdx}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Photo Grid Item ────────────────────────────────────────────────────────────
function PhotoGridItem({ photo, idx, isTall, isWide, onClick, onOpenEdit }) {
  const [imgError, setImgError] = useState(false);
  const [hover, setHover] = useState(false);
  const fileUrl = `/api/photos/${photo._id}/file`;
  const isVideo = photo.mimeType?.startsWith('video/');
  const hasSongs = photo.songs?.length > 0;

  const spanClasses = [
    isTall ? 'row-span-2' : '',
    isWide ? 'col-span-2' : '',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={`group relative rounded-2xl overflow-hidden cursor-pointer
                  bg-white/[0.03] border border-white/[0.06] 
                  hover:border-indigo-400/30 transition-all duration-300 ${spanClasses}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.5) }}
    >
      {isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-4xl">🎬</div>
      ) : imgError ? (
        <div className="w-full h-full flex items-center justify-center text-white/20">
          <ImageIcon size={32} />
        </div>
      ) : (
        <img
          src={fileUrl}
          alt={photo.title || photo.originalName}
          className={`w-full h-full object-cover transition-transform duration-700 ease-out
                     ${hover ? 'scale-110' : 'scale-100'}`}
          loading="lazy"
          onError={() => setImgError(true)}
          draggable={false}
        />
      )}

      {/* Shimmer overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
                       transition-opacity duration-300 ${hover ? 'opacity-100' : 'opacity-0'}`} />

      {/* Bottom info on hover */}
      <div className={`absolute inset-x-0 bottom-0 p-3 transition-all duration-300 
                       ${hover ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <p className="text-white text-xs font-medium truncate drop-shadow-lg">
          {photo.title || photo.originalName}
        </p>
        {photo.exif?.dateTaken && (
          <p className="text-white/50 text-[10px] mt-0.5 drop-shadow">
            {exifDate(photo.exif.dateTaken)}
          </p>
        )}
      </div>

      {/* Badges (top right) */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        {hasSongs && (
          <span className="w-7 h-7 rounded-full bg-purple-500/70 backdrop-blur-md flex items-center justify-center
                           border border-purple-300/20 shadow-lg shadow-purple-900/30">
            <Music size={11} className="text-white" />
          </span>
        )}
        {isVideo && (
          <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur-md
                           border border-white/10">
            VIDEO
          </span>
        )}
      </div>

      {/* Edit button (top left, on hover) */}
      {onOpenEdit && (
        <button
          onClick={e => { e.stopPropagation(); onOpenEdit(photo._id); }}
          className={`absolute top-2 left-2 p-2 rounded-xl bg-black/40 backdrop-blur-md text-white/60 
                      hover:text-white border border-white/10 transition-all duration-300
                      ${hover ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        >
          <Edit3 size={12} />
        </button>
      )}
    </motion.div>
  );
}

// ── Slideshow intervals ────────────────────────────────────────────────────────
const SLIDESHOW_SPEEDS = [
  { label: '3s', ms: 3000 },
  { label: '5s', ms: 5000 },
  { label: '8s', ms: 8000 },
  { label: '12s', ms: 12000 },
];

// ── Lightbox ───────────────────────────────────────────────────────────────────
function Lightbox({ photo, index, total, onClose, onPrev, onNext, onOpenEdit, allPhotos, setLightboxIdx }) {
  const [imgError, setImgError] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const slideshowRef = useRef(null);
  const thumbsRef = useRef(null);

  const isVideo = photo.mimeType?.startsWith('video/');
  const fileUrl = `/api/photos/${photo._id}/file`;

  // Auto slideshow
  useEffect(() => {
    if (!slideshow) { clearInterval(slideshowRef.current); return; }
    slideshowRef.current = setInterval(() => onNext(), SLIDESHOW_SPEEDS[speedIdx].ms);
    return () => clearInterval(slideshowRef.current);
  }, [slideshow, speedIdx, onNext]);

  // Stop slideshow at last photo
  useEffect(() => {
    if (slideshow && index >= total - 1) setSlideshow(false);
  }, [slideshow, index, total]);

  useEffect(() => { setImgError(false); }, [photo._id]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!thumbsRef.current) return;
    const active = thumbsRef.current.querySelector(`[data-idx="${index}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [index]);

  const toggleSlideshow = () => setSlideshow(s => !s);
  const cycleSpeed = () => setSpeedIdx(i => (i + 1) % SLIDESHOW_SPEEDS.length);

  return (
    <motion.div
      className="fixed inset-0 z-[3000] bg-black/[0.97] backdrop-blur-2xl flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <button onClick={onClose}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10
                     text-white/70 hover:text-white transition-all">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40 font-medium">{index + 1} / {total}</span>

          {/* Slideshow controls */}
          <div className="flex items-center gap-1 bg-white/5 rounded-2xl px-2 py-1 border border-white/10">
            <button onClick={toggleSlideshow}
              className={`p-2 rounded-xl transition-all ${
                slideshow
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
              title={slideshow ? 'Stop slideshow' : 'Start slideshow'}>
              {slideshow ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={cycleSpeed}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-white/50 hover:text-white 
                         hover:bg-white/10 transition-all min-w-[40px] text-center"
              title="Change slideshow speed">
              {SLIDESHOW_SPEEDS[speedIdx].label}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {onOpenEdit && (
            <button onClick={() => { setSlideshow(false); onOpenEdit(photo._id); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10
                         border border-white/10 text-white/70 hover:text-white text-xs transition-all">
              <Edit3 size={13} /> Edit
            </button>
          )}
          <a href={fileUrl} download={photo.originalName} target="_blank" rel="noreferrer"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10
                       text-white/70 hover:text-white transition-all">
            <Download size={16} />
          </a>
        </div>
      </div>

      {/* Slideshow progress bar */}
      {slideshow && (
        <div className="h-[2px] bg-white/5 shrink-0 overflow-hidden">
          <motion.div
            key={`${photo._id}-${speedIdx}`}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: SLIDESHOW_SPEEDS[speedIdx].ms / 1000, ease: 'linear' }}
          />
        </div>
      )}

      {/* Main media area */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden">
        {/* Prev */}
        <button onClick={() => { setSlideshow(false); onPrev(); }} disabled={index <= 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-2xl
                     bg-white/5 hover:bg-white/15 border border-white/10
                     text-white/70 hover:text-white disabled:opacity-10 transition-all">
          <ChevronLeft size={22} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={photo._id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-[calc(100%-120px)] max-h-full px-10 py-4 flex items-center justify-center"
          >
            {isVideo ? (
              <video src={fileUrl} controls autoPlay muted
                className="max-h-[78vh] max-w-full object-contain rounded-2xl shadow-2xl" />
            ) : imgError ? (
              <div className="text-white/20 text-sm">Failed to load image.</div>
            ) : (
              <img src={fileUrl} alt={photo.title || photo.originalName}
                onError={() => setImgError(true)}
                className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl shadow-black/50 select-none"
                draggable={false}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Next */}
        <button onClick={() => { setSlideshow(false); onNext(); }} disabled={index >= total - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-2xl
                     bg-white/5 hover:bg-white/15 border border-white/10
                     text-white/70 hover:text-white disabled:opacity-10 transition-all">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Bottom: photo info + thumbnail strip */}
      <div className="shrink-0 border-t border-white/[0.06] bg-black/60 backdrop-blur-xl">
        {/* Info row */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-sm font-semibold truncate">
              {photo.title || photo.originalName}
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
              {photo.exif?.dateTaken && <span>{exifDate(photo.exif.dateTaken)}</span>}
              {photo.exif?.make && <span className="flex items-center gap-1"><Camera size={10} />{photo.exif.make} {photo.exif.model || ''}</span>}
            </div>
          </div>
          {photo.tags?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {photo.tags.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 
                                          border border-indigo-400/20">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {allPhotos.length > 1 && (
          <div className="px-4 pb-3 overflow-x-auto" ref={thumbsRef}
               style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-1.5 justify-center">
              {allPhotos.map((p, i) => (
                <button
                  key={p._id}
                  data-idx={i}
                  onClick={() => { setSlideshow(false); setLightboxIdx(i); }}
                  className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200
                             ${i === index
                               ? 'border-indigo-400 ring-2 ring-indigo-400/30 scale-110'
                               : 'border-transparent opacity-50 hover:opacity-80'}`}
                >
                  <img
                    src={`/api/photos/${p._id}/file`}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Album Music Player (gorgeous bottom bar) ───────────────────────────────────
function AlbumMusicPlayer({ songs, songOwnerMap }) {
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setIdx(0);
  }, [songs]);

  const current = queue[idx] || null;
  const photoId = current ? songOwnerMap[current._id] : null;
  const src = current && photoId ? `/api/photos/${photoId}/songs/${current._id}/file` : null;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.src = src;
    el.volume = volume;
    el.muted = muted;
    el.load();
    if (playing) el.play().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  const play = () => { audioRef.current?.play(); setPlaying(true); };
  const pause = () => { audioRef.current?.pause(); setPlaying(false); };
  const next = useCallback(() => { setIdx(i => (i + 1) % Math.max(queue.length, 1)); setCurrentTime(0); }, [queue.length]);
  const prev = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      setIdx(i => (i - 1 + Math.max(queue.length, 1)) % Math.max(queue.length, 1));
      setCurrentTime(0);
    }
  }, [queue.length]);
  const handleEnded = useCallback(() => next(), [next]);

  const seek = v => {
    const t = v * duration;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const progress = duration ? currentTime / duration : 0;
  const fmt = secs => {
    if (!isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#0d0f18]/95 backdrop-blur-2xl">
      <audio ref={audioRef}
        onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
        onDurationChange={e => setDuration(e.target.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />

      {/* Progress bar (full width, thin line at top) */}
      <div className="h-1 bg-white/5 cursor-pointer group"
        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rect.left) / rect.width); }}>
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-150 
                        group-hover:h-1.5 relative"
          style={{ width: `${progress * 100}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white 
                          shadow-lg shadow-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-3">
        {/* Track info */}
        <div className="flex items-center gap-3 min-w-0 w-60 shrink-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                          ${playing
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                            : 'bg-white/5 border border-white/10'}`}>
            <Music size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-sm font-medium truncate">{current?.originalName || 'No songs'}</p>
            <p className="text-white/30 text-xs">{idx + 1} of {queue.length}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-2 text-white/40 hover:text-white transition-colors">
            <SkipBack size={16} />
          </button>
          <button onClick={playing ? pause : play}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center 
                       hover:scale-105 active:scale-95 transition-transform shadow-lg">
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#0a0c14"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#0a0c14"><polygon points="4,1 13,7 4,13"/></svg>
            )}
          </button>
          <button onClick={next} className="p-2 text-white/40 hover:text-white transition-colors">
            <SkipForward size={16} />
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-white/30 shrink-0">
          <span>{fmt(currentTime)}</span>
          <span>/</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setMuted(m => !m)} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setVolume(v);
              if (v > 0) setMuted(false);
            }}>
            <div className="h-full bg-white/40 rounded-full group-hover:bg-white/60 transition-colors"
              style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
