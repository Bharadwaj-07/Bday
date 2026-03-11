import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Trash2, Link2, Loader2, Image as ImageIcon, Video, X, Unlink, Tag, Filter } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { photosApi, pinsApi } from '../services/api';
import { useUpload } from '../hooks/usePhotos';

const ACCEPTED = {
  'image/*': ['.jpg','.jpeg','.png','.heic','.heif','.webp','.tiff'],
  'video/*': ['.mp4','.mov','.avi','.webm'],
};

export default function MediaManager({ photos, pins, onRefreshPhotos, onRefreshPins }) {
  const [linkingId, setLinkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [catEditId, setCatEditId] = useState(null);
  const [catInput, setCatInput] = useState('');
  const [editCats, setEditCats] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');

  const { upload, uploading, progress, results } = useUpload(() => onRefreshPhotos());

  // All known categories across photos
  const allCategories = useMemo(() => {
    const set = new Set();
    photos.forEach(p => (p.categories || []).forEach(c => set.add(c)));
    return [...set].sort();
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    if (!filterCategory) return photos;
    return photos.filter(p => (p.categories || []).includes(filterCategory));
  }, [photos, filterCategory]);

  // Category editing
  const startCatEdit = useCallback((photo) => {
    setCatEditId(photo._id);
    setEditCats(photo.categories || []);
    setCatInput('');
    setLinkingId(null);
  }, []);

  const addCat = useCallback((val) => {
    const clean = val.trim().toLowerCase();
    if (clean && !editCats.includes(clean)) setEditCats(prev => [...prev, clean]);
    setCatInput('');
  }, [editCats]);

  const removeCat = useCallback((cat) => {
    setEditCats(prev => prev.filter(c => c !== cat));
  }, []);

  const saveCats = useCallback(async () => {
    try {
      await photosApi.update(catEditId, { categories: editCats });
      toast.success('Categories updated!');
      setCatEditId(null);
      onRefreshPhotos();
    } catch (err) { toast.error(err.message); }
  }, [catEditId, editCats, onRefreshPhotos]);

  const catSuggestions = useMemo(() => {
    if (!catInput.trim()) return [];
    return allCategories.filter(c => c.includes(catInput.toLowerCase().trim()) && !editCats.includes(c));
  }, [catInput, allCategories, editCats]);

  const onDrop = useCallback(accepted => {
    if (!accepted.length || uploading) return;
    upload(accepted);
  }, [upload, uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  const deletePhoto = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await photosApi.delete(id);
      toast.success('Deleted');
      onRefreshPhotos();
    } catch (err) { toast.error(err.message); }
    finally { setDeletingId(null); }
  }, [onRefreshPhotos]);

  const linkToPin = useCallback(async (photoId, pinId) => {
    try {
      await pinsApi.linkPhotos(pinId, [photoId]);
      toast.success('Linked to pin!');
      setLinkingId(null);
      onRefreshPins();
    } catch (err) { toast.error(err.message); }
  }, [onRefreshPins]);

  const unlinkFromPin = useCallback(async (photoId, pinId) => {
    try {
      await pinsApi.unlinkPhoto(pinId, photoId);
      toast.success('Unlinked from pin');
      onRefreshPins();
    } catch (err) { toast.error(err.message); }
  }, [onRefreshPins]);

  // Build a map: photoId -> [pin objects that contain it]
  const linkedPinsMap = useMemo(() => {
    const map = {};
    for (const pin of pins) {
      for (const pid of (pin.photoIds || [])) {
        if (!map[pid]) map[pid] = [];
        map[pid].push(pin);
      }
    }
    return map;
  }, [pins]);

  return (
    <div className="flex flex-col h-full">
      {/* Upload section */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Camera size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Photo & Video Library</span>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
              : 'border-surface-border hover:border-cyan-400/50 hover:bg-cyan-500/5'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={24} className={`mx-auto mb-2 ${isDragActive ? 'text-cyan-400' : 'text-cyan-400/60'}`} />
          {isDragActive ? (
            <p className="text-sm text-cyan-300 font-medium">Drop to upload</p>
          ) : (
            <>
              <p className="text-sm text-slate-400 font-medium">Upload Photos & Videos</p>
              <p className="text-xs text-slate-600 mt-1">JPG, PNG, HEIC, WebP, MP4, MOV</p>
            </>
          )}
        </div>

        {uploading && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
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
                  const alreadyLinked = (pin.photoIds || []).includes(linkingId);
                  return (
                    <button key={pin._id}
                      onClick={() => alreadyLinked ? unlinkFromPin(linkingId, pin._id) : linkToPin(linkingId, pin._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs ${
                        alreadyLinked
                          ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300'
                          : 'bg-surface border-surface-border hover:bg-surface-hover hover:border-indigo-400/30 text-white'
                      }`}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pin.color || '#6366f1' }} />
                      <span className="truncate max-w-[80px]">{pin.name}</span>
                      {alreadyLinked && <Unlink size={10} className="shrink-0 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category edit panel */}
      <AnimatePresence>
        {catEditId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 border-b border-surface-border overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Edit Categories</p>
                <div className="flex gap-1">
                  <button onClick={saveCats}
                    className="px-2 py-1 rounded-lg text-xs bg-accent text-white hover:bg-accent-dark transition-colors">
                    Save
                  </button>
                  <button onClick={() => setCatEditId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Current categories */}
              <div className="flex flex-wrap gap-1">
                {editCats.map(cat => (
                  <span key={cat} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                    bg-cyan-500/15 text-cyan-300 border border-cyan-400/20">
                    {cat}
                    <button type="button" onClick={() => removeCat(cat)} className="hover:text-white">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              {/* Input */}
              <div className="relative">
                <input
                  value={catInput}
                  onChange={e => setCatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCat(catInput); }
                    else if (e.key === 'Backspace' && !catInput && editCats.length) removeCat(editCats[editCats.length - 1]);
                  }}
                  placeholder={editCats.length ? 'Add more…' : 'Type category + Enter'}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5
                             text-xs text-white placeholder-slate-600 outline-none focus:border-accent/60 transition-colors"
                />
                {catInput.trim() && catSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 glass rounded-lg border border-surface-border shadow-xl max-h-28 overflow-y-auto">
                    {catSuggestions.slice(0, 6).map(s => (
                      <button key={s} type="button" onClick={() => addCat(s)}
                        className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-surface-hover hover:text-white transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo/Video list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {/* Category filter */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2 px-1">
            <Filter size={11} className="text-slate-500 shrink-0" />
            <button onClick={() => setFilterCategory('')}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                !filterCategory ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'border-surface-border text-slate-500 hover:text-white'
              }`}>All</button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(f => f === cat ? '' : cat)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterCategory === cat ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'border-surface-border text-slate-500 hover:text-white'
                }`}>{cat}</button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold px-1 mb-1">
          {filteredPhotos.length} item{filteredPhotos.length !== 1 ? 's' : ''}{filterCategory ? ` in "${filterCategory}"` : ''}
        </p>

        {filteredPhotos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-3">
            <ImageIcon size={32} strokeWidth={1} />
            <p className="text-sm">No media yet</p>
            <p className="text-xs text-slate-700">Upload photos or videos to link them to pins</p>
          </div>
        )}

        {/* Grid view for photos */}
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {filteredPhotos.map((photo) => (
              <motion.div
                key={photo._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative rounded-xl overflow-hidden border border-surface-border bg-surface 
                           hover:border-cyan-400/30 transition-all aspect-square"
              >
                {photo.mediaType === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <Video size={24} className="text-slate-500" />
                  </div>
                ) : (
                  <img
                    src={photosApi.fileUrl(photo._id)}
                    alt={photo.title || photo.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent 
                               opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 inset-x-0 p-2">
                    <p className="text-white text-[10px] font-medium truncate">
                      {photo.title || photo.originalName}
                    </p>
                    {/* Linked pin badges */}
                    {(linkedPinsMap[photo._id] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {linkedPinsMap[photo._id].map(lp => (
                          <span key={lp._id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium
                                       bg-black/50 backdrop-blur-sm border border-white/10 text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lp.color || '#6366f1' }} />
                            {lp.name}
                            <button onClick={(e) => { e.stopPropagation(); unlinkFromPin(photo._id, lp._id); }}
                              className="ml-0.5 text-white/40 hover:text-red-400 transition-colors">
                              <X size={8} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Category badges */}
                    {(photo.categories || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {photo.categories.map(cat => (
                          <span key={cat} className="text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/20">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setLinkingId(linkingId === photo._id ? null : photo._id); setCatEditId(null); }}
                      className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
                        linkingId === photo._id
                          ? 'bg-indigo-500/50 text-indigo-200 ring-1 ring-indigo-400/40'
                          : 'bg-black/50 text-white/60 hover:text-indigo-400'
                      }`}
                      title="Link to pin">
                      <Link2 size={11} />
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); startCatEdit(photo); }}
                      className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
                        catEditId === photo._id
                          ? 'bg-cyan-500/50 text-cyan-200 ring-1 ring-cyan-400/40'
                          : 'bg-black/50 text-white/60 hover:text-cyan-400'
                      }`}
                      title="Edit categories">
                      <Tag size={11} />
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); deletePhoto(photo._id); }}
                      disabled={deletingId === photo._id}
                      className="p-1.5 rounded-lg bg-black/50 text-white/60 hover:text-red-400 backdrop-blur-sm transition-colors">
                      {deletingId === photo._id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>

                {photo.mediaType === 'video' && (
                  <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    VIDEO
                  </span>
                )}

                {/* Persistent category indicator (visible without hover) */}
                {(photo.categories || []).length > 0 && (
                  <div className="absolute bottom-1.5 left-1.5 flex gap-0.5 pointer-events-none group-hover:opacity-0 transition-opacity">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-black/60 text-cyan-300 backdrop-blur-sm border border-cyan-400/20">
                      {photo.categories.length} cat{photo.categories.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
