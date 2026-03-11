import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MapPin, Music, Camera, ChevronLeft, ChevronRight,
  Play, Pause, SkipForward, Volume2, VolumeX, Heart, Sparkles
} from 'lucide-react';
import { photosApi, musicApi } from '../services/api';

export default function PinPopup({ pin, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [musicList, setMusicList] = useState([]);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentMusicIdx, setCurrentMusicIdx] = useState(0);
  const [loved, setLoved] = useState(false);
  const audioRef = useRef(null);

  // Load linked photos and music
  useEffect(() => {
    if (!pin) return;
    const loadPhotos = async () => {
      if (!pin.photoIds?.length) return;
      const promises = pin.photoIds.map(id =>
        photosApi.getOne(id).then(r => r.data).catch(() => null)
      );
      const results = (await Promise.all(promises)).filter(Boolean);
      setPhotos(results);
    };
    const loadMusic = async () => {
      if (!pin.musicIds?.length) return;
      // We already have musicIds, just build the list from what we have
      setMusicList(pin.musicIds.map(id => ({ _id: id })));
    };
    loadPhotos();
    loadMusic();
  }, [pin]);

  // Auto-play music
  useEffect(() => {
    if (!playing || !musicList.length || !audioRef.current) return;
    audioRef.current.src = musicApi.fileUrl(musicList[currentMusicIdx]._id);
    audioRef.current.play().catch(() => {});
  }, [currentMusicIdx, playing, musicList]);

  const toggleMusic = () => {
    if (!musicList.length) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const nextMusic = () => {
    if (!musicList.length) return;
    setCurrentMusicIdx(i => (i + 1) % musicList.length);
  };

  const nextPhoto = useCallback(() => {
    setCurrentPhotoIdx(i => (i + 1) % Math.max(photos.length, 1));
  }, [photos.length]);

  const prevPhoto = useCallback(() => {
    setCurrentPhotoIdx(i => (i - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1));
  }, [photos.length]);

  // Auto cycle photos every 5s
  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(nextPhoto, 5000);
    return () => clearInterval(timer);
  }, [photos.length, nextPhoto]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prevPhoto, nextPhoto]);

  if (!pin) return null;

  const pinColor = pin.color || '#6366f1';
  const currentPhoto = photos[currentPhotoIdx] || null;
  const photoUrl = currentPhoto ? photosApi.fileUrl(currentPhoto._id) : null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop with blur */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Main popup card */}
        <motion.div
          className="relative w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
          initial={{ scale: 0.85, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          style={{
            background: `linear-gradient(135deg, ${pinColor}15 0%, #0f111780 40%, #0f111790 100%)`,
          }}
        >
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-3xl p-[1.5px] overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 rounded-3xl animate-border-spin"
              style={{
                background: `conic-gradient(from 0deg, ${pinColor}, #ec4899, #8b5cf6, #06b6d4, ${pinColor})`,
                opacity: 0.5,
              }}
            />
          </div>

          {/* Inner container */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{ background: 'rgba(15, 17, 23, 0.92)', backdropFilter: 'blur(40px)' }}>

            {/* Close button */}
            <button onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 rounded-2xl bg-black/40 backdrop-blur-md
                         text-white/60 hover:text-white border border-white/10 hover:border-white/20
                         transition-all hover:scale-105">
              <X size={16} />
            </button>

            {/* Photo carousel area */}
            <div className="relative h-72 overflow-hidden">
              {photoUrl ? (
                <>
                  {/* Background blur */}
                  <div className="absolute inset-0 scale-125">
                    <img src={photoUrl} alt="" className="w-full h-full object-cover blur-3xl opacity-30" />
                  </div>
                  {/* Current photo */}
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentPhoto._id}
                      src={photoUrl}
                      alt={currentPhoto.title || currentPhoto.originalName}
                      className="relative w-full h-full object-cover"
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5 }}
                    />
                  </AnimatePresence>
                  {/* Photo navigation */}
                  {photos.length > 1 && (
                    <>
                      <button onClick={prevPhoto}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-black/40 backdrop-blur-md
                                   text-white/70 hover:text-white border border-white/10 transition-all hover:scale-105">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={nextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-black/40 backdrop-blur-md
                                   text-white/70 hover:text-white border border-white/10 transition-all hover:scale-105">
                        <ChevronRight size={16} />
                      </button>
                      {/* Dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => (
                          <button key={i} onClick={() => setCurrentPhotoIdx(i)}
                            className={`rounded-full transition-all ${
                              i === currentPhotoIdx
                                ? 'w-6 h-2 bg-white'
                                : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                            }`} />
                        ))}
                      </div>
                    </>
                  )}
                  {/* Gradient fade at bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0f1117] to-transparent" />
                </>
              ) : (
                /* No photos - decorative pattern */
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${pinColor}20, ${pinColor}05)` }}>
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-3 flex items-center justify-center"
                      style={{ background: `${pinColor}20`, border: `2px solid ${pinColor}30` }}>
                      <MapPin size={32} style={{ color: pinColor }} />
                    </div>
                    <p className="text-white/30 text-sm">No photos linked yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Pin info section */}
            <div className="relative px-6 pt-4 pb-3">
              {/* Colored glow orb */}
              <div className="absolute -top-8 left-6 w-16 h-16 rounded-full opacity-40 blur-2xl"
                style={{ background: pinColor }} />

              <div className="flex items-start justify-between">
                <div>
                  {/* Pin badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                      style={{
                        background: `${pinColor}20`,
                        color: pinColor,
                        border: `1px solid ${pinColor}40`,
                      }}>
                      <Sparkles size={9} />
                      Memory Pin
                    </span>
                  </div>
                  {/* Name */}
                  <h2 className="text-2xl font-bold text-white tracking-tight leading-tight mb-1">
                    {pin.name}
                  </h2>
                  {/* Description */}
                  {pin.description && (
                    <p className="text-sm text-white/50 mb-2 line-clamp-2">{pin.description}</p>
                  )}
                  {/* Coordinates */}
                  <p className="text-xs text-white/25 font-mono">
                    {pin.lat?.toFixed(5)}°, {pin.lng?.toFixed(5)}°
                  </p>
                </div>

                {/* Love button */}
                <button onClick={() => setLoved(l => !l)}
                  className={`p-3 rounded-2xl transition-all ${
                    loved
                      ? 'bg-pink-500/20 text-pink-400 scale-110 border border-pink-400/30'
                      : 'bg-white/5 text-white/30 hover:text-pink-400 border border-white/10'
                  }`}>
                  <Heart size={18} fill={loved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="px-6 pb-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <Camera size={12} className="text-cyan-400" />
                <span className="text-xs text-white/60">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <Music size={12} className="text-purple-400" />
                <span className="text-xs text-white/60">{musicList.length} song{musicList.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Music player bar */}
            {musicList.length > 0 && (
              <div className="mx-4 mb-4 rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${pinColor}15, rgba(139,92,246,0.1))`,
                  border: `1px solid ${pinColor}25`,
                }}>
                <audio ref={audioRef} onEnded={nextMusic} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={toggleMusic}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: playing ? pinColor : `${pinColor}30`,
                      boxShadow: playing ? `0 4px 16px ${pinColor}40` : 'none',
                    }}>
                    {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium truncate">
                      {musicList.length > 0 ? `Track ${currentMusicIdx + 1} of ${musicList.length}` : 'No music'}
                    </p>
                    <p className="text-[10px] text-white/30">Click play to listen</p>
                  </div>
                  {musicList.length > 1 && (
                    <button onClick={nextMusic}
                      className="p-2 rounded-xl text-white/40 hover:text-white transition-colors">
                      <SkipForward size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Photo thumbnails strip */}
            {photos.length > 1 && (
              <div className="px-4 pb-4">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {photos.map((p, i) => (
                    <button key={p._id} onClick={() => setCurrentPhotoIdx(i)}
                      className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                        i === currentPhotoIdx
                          ? 'border-white/60 ring-2 scale-105'
                          : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                      style={{
                        ringColor: i === currentPhotoIdx ? `${pinColor}50` : 'transparent',
                      }}>
                      <img src={photosApi.fileUrl(p._id)} alt=""
                        className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Floating sparkle particles (decorative) */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full pointer-events-none"
            style={{ background: pinColor }}
            initial={{
              x: Math.random() * 400 - 200,
              y: Math.random() * 400 - 200,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              x: Math.random() * 600 - 300,
              y: Math.random() * 600 - 300,
              opacity: [0, 0.8, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: i * 0.2,
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
