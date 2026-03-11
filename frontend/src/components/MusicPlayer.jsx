import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, Music } from 'lucide-react';
import { photosApi } from '../services/api';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(secs) {
  if (!isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MusicPlayer({ photoId, songs = [], autoPlay = false, compact = false }) {
  const audioRef    = useRef(null);
  const [queue, setQueue]           = useState([]);
  const [idx, setIdx]               = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [shuffled, setShuffled]     = useState(true);
  const [duration, setDuration]     = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted]           = useState(false);
  const [volume, setVolume]         = useState(0.85);
  const [dragging, setDragging]     = useState(false);

  // Build / rebuild queue when songs or shuffle changes
  useEffect(() => {
    if (!songs.length) return;
    const q = shuffled ? shuffleArray(songs) : [...songs];
    setQueue(q);
    setIdx(0);
  }, [songs, shuffled]);

  const current = queue[idx] || null;
  const src     = current ? photosApi.songUrl(photoId, current._id) : null;

  // Load new src
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.src       = src;
    el.volume    = volume;
    el.muted     = muted;
    el.load();
    if (autoPlay || playing) el.play().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted  = muted;
  }, [volume, muted]);

  const play  = () => { audioRef.current?.play(); setPlaying(true); };
  const pause = () => { audioRef.current?.pause(); setPlaying(false); };

  const next = useCallback(() => {
    setIdx(i => (i + 1) % Math.max(queue.length, 1));
    setCurrentTime(0);
  }, [queue.length]);

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

  if (!songs.length) return (
    <div className="flex items-center gap-2 text-slate-600 text-sm py-2">
      <Music size={15} /> <span>No songs attached</span>
    </div>
  );

  const progress = duration ? currentTime / duration : 0;

  if (compact) {
    /* Mini inline bar */
    return (
      <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-xl px-3 py-2">
        <audio ref={audioRef} onTimeUpdate={e => { if (!dragging) setCurrentTime(e.target.currentTime); }}
          onDurationChange={e => setDuration(e.target.duration)} onEnded={handleEnded} />
        <button onClick={playing ? pause : play} className="text-accent-light hover:text-accent transition-colors">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        {/* progress */}
        <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden cursor-pointer"
          onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rect.left) / rect.width); }}>
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[10px] font-mono text-slate-500 min-w-[32px]">{fmt(currentTime)}</span>
        <button onClick={next} className="text-slate-500 hover:text-slate-300"><SkipForward size={14} /></button>
        <div className="text-xs text-slate-500 max-w-[130px] truncate">{current?.originalName}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden">
      <audio ref={audioRef}
        onTimeUpdate={e => { if (!dragging) setCurrentTime(e.target.currentTime); }}
        onDurationChange={e => setDuration(e.target.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />

      {/* Track info */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          {/* Animated vinyl */}
          <motion.div
            className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/30 to-purple-900/50 border-2 border-accent/30 flex items-center justify-center shrink-0"
            animate={{ rotate: playing ? 360 : 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          >
            <div className="w-4 h-4 rounded-full bg-surface border border-surface-border" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p key={current?._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="text-white text-sm font-semibold truncate">
                {current?.originalName || 'No song selected'}
              </motion.p>
            </AnimatePresence>
            <p className="text-slate-500 text-xs mt-0.5">{idx + 1} / {queue.length}</p>
          </div>
          <button onClick={() => setShuffled(s => !s)} title="Shuffle"
            className={`p-1.5 rounded-lg transition-colors ${shuffled ? 'text-accent-light bg-accent/10' : 'text-slate-600 hover:text-slate-400'}`}>
            <Shuffle size={14} />
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <div className="px-5 pb-1">
        <div
          className="relative h-2 group flex items-center cursor-pointer"
          onMouseDown={e => {
            setDragging(true);
            const rect = e.currentTarget.getBoundingClientRect();
            seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
          }}
          onMouseMove={e => {
            if (!dragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
          }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          <div className="w-full h-1 bg-surface-hover rounded-full overflow-visible">
            <div className="h-full bg-accent rounded-full relative" style={{ width: `${progress * 100}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
          <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-5 pb-4">
        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMuted(m => !m)} className="text-slate-500 hover:text-slate-300 p-1 rounded">
            {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
            onChange={e => { setVolume(+e.target.value); if (+e.target.value > 0) setMuted(false); }}
            className="w-16 accent-violet-500 cursor-pointer" />
        </div>

        {/* Play / Prev / Next */}
        <div className="flex items-center gap-3">
          <button onClick={prev} className="text-slate-400 hover:text-white transition-colors"><SkipBack size={18} /></button>
          <button onClick={playing ? pause : play}
            className="w-10 h-10 rounded-full bg-accent hover:bg-accent-dark flex items-center justify-center shadow-lg transition-colors">
            {playing ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
          </button>
          <button onClick={next} className="text-slate-400 hover:text-white transition-colors"><SkipForward size={18} /></button>
        </div>

        {/* Spacer */}
        <div className="w-[80px]" />
      </div>
    </div>
  );
}
