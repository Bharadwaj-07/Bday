import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Upload, Trash2, Link2, Loader2, Play, Pause, X, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { musicApi, pinsApi } from '../services/api';
import { useMusicUpload } from '../hooks/usePhotos';

export default function MusicManager({ music, pins, onRefreshMusic, onRefreshPins }) {
  const [playingId, setPlayingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const { upload, uploading, progress } = useMusicUpload(() => onRefreshMusic());

  const handleUpload = (e) => {
    const files = e.target.files;
    if (files?.length) upload(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePlay = useCallback((id) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = musicApi.fileUrl(id);
        audioRef.current.play().catch(() => {});
      }
      setPlayingId(id);
    }
  }, [playingId]);

  const deleteMusic = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await musicApi.delete(id);
      toast.success('Song deleted');
      if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
      onRefreshMusic();
    } catch (err) { toast.error(err.message); }
    finally { setDeletingId(null); }
  }, [onRefreshMusic, playingId]);

  const linkToPin = useCallback(async (musicId, pinId) => {
    try {
      await pinsApi.linkMusic(pinId, [musicId]);
      toast.success('Linked to pin!');
      setLinkingId(null);
      onRefreshPins();
    } catch (err) { toast.error(err.message); }
  }, [onRefreshPins]);

  const unlinkFromPin = useCallback(async (musicId, pinId) => {
    try {
      await pinsApi.unlinkMusic(pinId, musicId);
      toast.success('Unlinked from pin');
      onRefreshPins();
    } catch (err) { toast.error(err.message); }
  }, [onRefreshPins]);

  // Build a map: musicId -> [pin objects that contain it]
  const linkedPinsMap = useMemo(() => {
    const map = {};
    for (const pin of pins) {
      for (const mid of (pin.musicIds || [])) {
        if (!map[mid]) map[mid] = [];
        map[mid].push(pin);
      }
    }
    return map;
  }, [pins]);

  const formatSize = bytes => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Upload section */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Music size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Music Library</span>
        </div>

        <div
          className="border-2 border-dashed border-surface-border rounded-xl p-5 text-center cursor-pointer 
                     hover:border-purple-400/50 hover:bg-purple-500/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" multiple hidden onChange={handleUpload} />
          <Upload size={24} className="mx-auto mb-2 text-purple-400/60" />
          <p className="text-sm text-slate-400 font-medium">Upload Music</p>
          <p className="text-xs text-slate-600 mt-1">MP3, AAC, OGG, WAV, FLAC</p>
        </div>

        {uploading && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                animate={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Link-to-pin panel (renders outside the scroll area) */}
      <AnimatePresence>
        {linkingId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 border-b border-surface-border overflow-hidden"
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white">Link to Pin</p>
                <button onClick={() => setLinkingId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors">
                  <X size={12} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {pins.length === 0 ? (
                  <p className="text-xs text-slate-500">No pins — create one first</p>
                ) : pins.map(pin => {
                  const alreadyLinked = (pin.musicIds || []).includes(linkingId);
                  return (
                    <button key={pin._id}
                      onClick={() => alreadyLinked ? unlinkFromPin(linkingId, pin._id) : linkToPin(linkingId, pin._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs ${
                        alreadyLinked
                          ? 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                          : 'bg-surface border-surface-border hover:bg-surface-hover hover:border-purple-400/30 text-white'
                      }`}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pin.color || '#6366f1' }} />
                      <span className="truncate max-w-[80px]">{pin.name}</span>
                      {alreadyLinked && <Unlink size={10} className="shrink-0 text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold px-1 mb-1">
          {music.length} song{music.length !== 1 ? 's' : ''}
        </p>

        {music.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-3">
            <Music size={32} strokeWidth={1} />
            <p className="text-sm">No music yet</p>
            <p className="text-xs text-slate-700">Upload songs to link them to pins</p>
          </div>
        )}

        <AnimatePresence>
          {music.map((song) => (
            <motion.div
              key={song._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group rounded-xl border border-surface-border bg-surface hover:bg-surface-hover transition-all"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Play/Pause button */}
                <button onClick={() => togglePlay(song._id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    playingId === song._id
                      ? 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30'
                      : 'bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20'
                  }`}>
                  {playingId === song._id
                    ? <Pause size={14} className="text-white" />
                    : <Play size={14} className="text-purple-400 ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{song.originalName}</p>
                  <p className="text-[11px] text-slate-500">{formatSize(song.size)}</p>
                  {/* Linked pin badges */}
                  {(linkedPinsMap[song._id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {linkedPinsMap[song._id].map(lp => (
                        <span key={lp._id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium
                                     bg-surface-hover border border-surface-border text-white/70">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lp.color || '#6366f1' }} />
                          {lp.name}
                          <button onClick={(e) => { e.stopPropagation(); unlinkFromPin(song._id, lp._id); }}
                            className="ml-0.5 text-white/30 hover:text-red-400 transition-colors">
                            <X size={8} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setLinkingId(linkingId === song._id ? null : song._id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      linkingId === song._id
                        ? 'text-indigo-400 bg-indigo-500/20 ring-1 ring-indigo-400/40'
                        : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'
                    }`}
                    title="Link to pin">
                    <Link2 size={13} />
                  </button>

                  <button onClick={() => deleteMusic(song._id)} disabled={deletingId === song._id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    {deletingId === song._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
