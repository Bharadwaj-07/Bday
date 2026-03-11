import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Music, Trash2, Upload, Save, Tag, FileText, Loader2, Navigation, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { photosApi } from '../services/api';
import { usePhotoDetail } from '../hooks/usePhotos';
import GPSPickerMap from './GPSPickerMap';

const TABS = ['Info', 'Location', 'Music'];

export default function PhotoEditModal({ id, allPins = [], onClose, onSaved }) {
  const { photo, loading, refresh } = usePhotoDetail(id);
  const [tab, setTab] = useState('Info');

  // ── Info state ──────────────────────────────────────────────────────────────
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [tags, setTags]         = useState('');
  const [saving, setSaving]     = useState(false);
  const infoInitRef             = useRef(false);

  // populate once loaded
  if (photo && !infoInitRef.current) {
    setTitle(photo.title || '');
    setDesc(photo.description || '');
    setTags((photo.tags || []).join(', '));
    infoInitRef.current = true;
  }

  const saveInfo = async () => {
    setSaving(true);
    try {
      await photosApi.update(id, {
        title: title.trim(),
        description: desc.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      toast.success('Info saved!');
      onSaved?.();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // ── Location state ──────────────────────────────────────────────────────────
  const [pickedLat, setPickedLat] = useState(null);
  const [pickedLng, setPickedLng] = useState(null);
  const [locLabel, setLocLabel]   = useState('');
  const [savingLoc, setSavingLoc] = useState(false);
  const [showExistingPins, setShowExistingPins] = useState(false);
  const [pinSearchQ, setPinSearchQ] = useState('');

  const handleGPSPick = useCallback((lat, lng) => {
    setPickedLat(lat);
    setPickedLng(lng);
  }, []);

  const selectExistingPin = useCallback((pin) => {
    setPickedLat(pin.lat);
    setPickedLng(pin.lng);
    setLocLabel(pin.label || '');
    setShowExistingPins(false);
    setPinSearchQ('');
  }, []);

  const filteredLocPins = allPins.filter(p => {
    if (!pinSearchQ.trim()) return true;
    const q = pinSearchQ.toLowerCase();
    return (p.label || '').toLowerCase().includes(q) || `${p.lat}, ${p.lng}`.includes(q);
  });

  const saveLocation = async () => {
    if (pickedLat == null || pickedLng == null) return toast.error('Pick a location on the map first.');
    setSavingLoc(true);
    try {
      await photosApi.setLocation(id, pickedLat, pickedLng, locLabel.trim() || undefined);
      toast.success('Location saved!');
      onSaved?.();
    } catch (err) { toast.error(err.message); }
    finally { setSavingLoc(false); }
  };

  // ── Songs state ─────────────────────────────────────────────────────────────
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicProgress, setMusicProgress]  = useState(0);
  const [deletingId, setDeletingId]        = useState(null);
  const audioInputRef = useRef(null);

  const uploadSongs = useCallback(async files => {
    if (!files?.length) return;
    setUploadingMusic(true);
    setMusicProgress(0);
    try {
      await photosApi.uploadSongs(id, Array.from(files), p => setMusicProgress(p));
      toast.success(`${files.length} song${files.length > 1 ? 's' : ''} added!`);
      refresh();
      onSaved?.();
    } catch (err) { toast.error(err.message); }
    finally { setUploadingMusic(false); audioInputRef.current.value = ''; }
  }, [id, refresh, onSaved]);

  const deleteSong = useCallback(async songId => {
    setDeletingId(songId);
    try {
      await photosApi.deleteSong(id, songId);
      toast.success('Song removed.');
      refresh();
      onSaved?.();
    } catch (err) { toast.error(err.message); }
    finally { setDeletingId(null); }
  }, [id, refresh, onSaved]);

  const formatSize = bytes => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative glass rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '90vh' }}
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
            <div>
              <h2 className="font-semibold text-white">Edit Photo</h2>
              {photo && <p className="text-xs text-slate-500 truncate mt-0.5 max-w-sm">{photo.originalName}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-surface-hover"><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-surface-border shrink-0 px-4">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-accent text-accent-light' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                {t}
                {t === 'Music' && photo?.songs?.length ? (
                  <span className="ml-1.5 text-[10px] bg-accent/30 text-accent-light px-1.5 py-0.5 rounded-full">{photo.songs.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <Loader2 size={28} className="animate-spin text-accent" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">

              {/* ── Info Tab ────────────────────────────────────────────────── */}
              {tab === 'Info' && (
                <div className="p-6 space-y-4">
                  <Field label="Title">
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give this photo a title…"
                      className="input-style" />
                  </Field>
                  <Field label="Description">
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="Write something about this moment…"
                      className="input-style resize-none" />
                  </Field>
                  <Field label="Tags (comma-separated)">
                    <div className="relative">
                      <Tag size={13} className="absolute left-3 top-3 text-slate-500" />
                      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="travel, sunset, family…"
                        className="input-style pl-9" />
                    </div>
                  </Field>
                  {tags.split(',').map(t => t.trim()).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 bg-accent/10 border border-accent/30 text-accent-light rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={saveInfo} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dark rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* ── Location Tab ─────────────────────────────────────────────── */}
              {tab === 'Location' && (
                <div className="p-6 space-y-4">
                  {/* Current location */}
                  {photo?.hasLocation && (
                    <div className="flex items-center gap-2 p-3 bg-surface rounded-xl border border-surface-border text-sm">
                      <MapPin size={14} className={photo.locationSource === 'exif' ? 'text-pin-exif' : 'text-pin-manual'} />
                      <div>
                        <p className="text-white text-xs font-medium">Current: {photo.lat?.toFixed(6)}°, {photo.lng?.toFixed(6)}°</p>
                        {photo.locationLabel && <p className="text-slate-500 text-xs">{photo.locationLabel}</p>}
                        <p className="text-slate-600 text-[11px]">Source: {photo.locationSource}</p>
                      </div>
                    </div>
                  )}

                  {/* Use existing pin */}
                  {allPins.length > 0 && (
                    <div className="space-y-2">
                      <button onClick={() => setShowExistingPins(s => !s)}
                        className="w-full flex items-center justify-between gap-2 py-2.5 px-4 rounded-xl
                                   border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-sm
                                   hover:bg-indigo-500/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <Navigation size={14} />
                          <span>Use existing pin location</span>
                          <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded-full text-indigo-200">{allPins.length}</span>
                        </div>
                        <ChevronDown size={14} className={`transition-transform ${showExistingPins ? 'rotate-180' : ''}`} />
                      </button>
                      {showExistingPins && (
                        <div className="border border-surface-border rounded-xl bg-surface overflow-hidden">
                          {allPins.length > 3 && (
                            <div className="p-2 border-b border-surface-border">
                              <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input value={pinSearchQ} onChange={e => setPinSearchQ(e.target.value)}
                                  placeholder="Search pins..." autoFocus
                                  className="w-full bg-surface-hover border border-surface-border rounded-lg pl-8 pr-3 py-1.5
                                             text-xs text-white placeholder-slate-600 outline-none focus:border-accent/60" />
                              </div>
                            </div>
                          )}
                          <div className="max-h-36 overflow-y-auto">
                            {filteredLocPins.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-500 text-center">No pins match</div>
                            ) : filteredLocPins.map((pin, i) => (
                              <button key={pin.id || i} onClick={() => selectExistingPin(pin)}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-hover
                                           transition-colors text-left border-b border-surface-border last:border-0">
                                <MapPin size={12} className={pin.locationSource === 'exif' ? 'text-pin-exif' : 'text-pin-manual'} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white truncate">{pin.label || `${pin.lat.toFixed(4)}\u00B0, ${pin.lng.toFixed(4)}\u00B0`}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map picker */}
                  <div className="h-72 rounded-xl overflow-hidden border border-surface-border">
                    <GPSPickerMap
                      onPick={handleGPSPick}
                      initialLat={pickedLat ?? photo?.lat}
                      initialLng={pickedLng ?? photo?.lng}
                      pins={allPins.filter(p => p.id?.toString() !== id)}
                    />
                  </div>

                  <Field label="Location label (optional)">
                    <input value={locLabel} onChange={e => setLocLabel(e.target.value)} placeholder="e.g. Eiffel Tower, Paris"
                      className="input-style" />
                  </Field>

                  {pickedLat != null && (
                    <p className="text-xs font-mono text-accent-light">
                      Selected: {pickedLat.toFixed(6)}°, {pickedLng.toFixed(6)}°
                    </p>
                  )}

                  <button onClick={saveLocation} disabled={savingLoc || pickedLat == null}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dark rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors">
                    {savingLoc ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    {savingLoc ? 'Saving PIN…' : 'Set Pin Here'}
                  </button>
                </div>
              )}

              {/* ── Music Tab ────────────────────────────────────────────────── */}
              {tab === 'Music' && (
                <div className="p-6 space-y-4">
                  {/* Upload */}
                  <div
                    className="border-2 border-dashed border-surface-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <input ref={audioInputRef} type="file" accept="audio/*" multiple hidden
                      onChange={e => uploadSongs(e.target.files)} />
                    <Music size={28} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-400 font-medium">Drop songs here or click to browse</p>
                    <p className="text-xs text-slate-600 mt-1">MP3 · AAC · OGG · WAV · FLAC · up to 20 MB each</p>
                  </div>

                  {uploadingMusic && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Uploading…</span><span>{musicProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <motion.div className="h-full bg-accent rounded-full" animate={{ width: `${musicProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Song list */}
                  {photo?.songs?.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                        {photo.songs.length} song{photo.songs.length > 1 ? 's' : ''}
                      </p>
                      {photo.songs.map(song => (
                        <div key={song._id} className="flex items-center gap-3 p-3 bg-surface border border-surface-border rounded-xl">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                            <Music size={16} className="text-accent-light" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{song.originalName}</p>
                            {song.size && <p className="text-xs text-slate-500">{formatSize(song.size)}</p>}
                          </div>
                          {/* Preview */}
                          <audio controls className="h-8 w-32" style={{ filter: 'invert(0.85) hue-rotate(180deg)', opacity: 0.9 }}
                            src={photosApi.songUrl(id, song._id)} />
                          <button onClick={() => deleteSong(song._id)} disabled={deletingId === song._id}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                            {deletingId === song._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-600 gap-2">
                      <Music size={28} />
                      <p className="text-sm">No songs yet — add some above</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
