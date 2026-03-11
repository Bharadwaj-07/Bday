import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, MapPinOff, Trash2, Edit2, Check, Camera, Calendar, Ruler, PenLine } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { photosApi } from '../services/api';
import { usePhotoDetail } from '../hooks/usePhotos';

function ExifRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-1 border-b border-surface-border last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-300 font-mono">{value}</span>
    </div>
  );
}

export default function PhotoDetail({ id, onClose, onSetPin, onDeleted, onOpenEdit }) {
  const { photo, loading, update } = usePhotoDetail(id);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle]         = useState('');
  const [deleting, setDeleting]   = useState(false);

  const handleEditTitle = () => {
    setTitle(photo?.title || '');
    setEditTitle(true);
  };
  const handleSaveTitle = async () => {
    await update({ title: title.trim() });
    setEditTitle(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this photo permanently?')) return;
    setDeleting(true);
    try {
      await photosApi.delete(id);
      toast.success('Deleted');
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[1500] flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dim the rest */}
        <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Drawer slides in from right */}
        <motion.aside
          className="relative w-full max-w-sm glass border-l border-surface-border flex flex-col overflow-hidden"
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
            <h2 className="font-semibold text-sm text-white">Photo Details</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-surface-hover">
              <X size={16} />
            </button>
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <span className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )}

          {photo && !loading && (
            <div className="flex-1 overflow-y-auto">
              {/* Image */}
              <div className="relative w-full aspect-square bg-surface-hover">
                {photo.mediaType === 'video' ? (
                  <video
                    src={photosApi.fileUrl(photo._id)}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={photosApi.fileUrl(photo._id)}
                    alt={photo.title || photo.originalName}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                )}

                {/* Source badge */}
                <span className={`absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full border
                  ${photo.locationSource === 'exif'
                    ? 'bg-pin-exif/20 text-pin-exif border-pin-exif/40'
                    : photo.locationSource === 'manual'
                      ? 'bg-pin-manual/20 text-pin-manual border-pin-manual/40'
                      : 'bg-slate-600/20 text-slate-400 border-slate-600/40'}`}>
                  {({ exif: 'GPS auto', manual: 'Manual pin', none: 'No location' })[photo.locationSource]}
                </span>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Title */}
                <div>
                  {editTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                        className="flex-1 bg-surface border border-accent/50 rounded-lg px-3 py-1.5
                                   text-sm text-white outline-none"
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditTitle(false); }}
                      />
                      <button onClick={handleSaveTitle} className="p-1.5 text-pin-exif hover:text-green-400">
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white text-sm leading-tight">
                          {photo.title || photo.originalName}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">{photo.originalName}</p>
                      </div>
                      <button
                        onClick={handleEditTitle}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-surface-hover shrink-0"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div>
                  <p className="text-[11px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Location</p>
                  {photo.hasLocation ? (
                    <div className="flex items-start gap-2 p-3 bg-surface rounded-xl border border-surface-border">
                      <MapPin size={14} className={photo.locationSource === 'exif' ? 'text-pin-exif mt-0.5' : 'text-pin-manual mt-0.5'} />
                      <div>
                        {photo.locationLabel && <p className="text-sm text-white">{photo.locationLabel}</p>}
                        <p className="text-xs font-mono text-slate-400">
                          {photo.lat?.toFixed(6)}°, {photo.lng?.toFixed(6)}°
                        </p>
                        {photo.exif?.altitude != null && (
                          <p className="text-xs text-slate-500 mt-0.5">{Math.round(photo.exif.altitude)} m altitude</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { onSetPin(photo); onClose(); }}
                      className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed
                                 border-pin-manual/40 text-pin-manual text-sm hover:bg-pin-manual/10
                                 transition-colors"
                    >
                      <MapPinOff size={15} />
                      <span>No location — click to add pin</span>
                    </button>
                  )}
                </div>

                {/* EXIF */}
                {Object.keys(photo.exif || {}).length > 0 && (
                  <div>
                    <p className="text-[11px] text-slate-600 uppercase tracking-widest font-semibold mb-2">Camera Info</p>
                    <div className="bg-surface rounded-xl border border-surface-border px-3 py-1">
                      <ExifRow label="Camera" value={[photo.exif.make, photo.exif.model].filter(Boolean).join(' ')} />
                      <ExifRow label="Date" value={photo.exif.dateTaken ? format(new Date(photo.exif.dateTaken), 'PPP') : null} />
                      <ExifRow label="Focal length" value={photo.exif.focalLength ? `${photo.exif.focalLength}mm` : null} />
                      <ExifRow label="Aperture" value={photo.exif.aperture ? `ƒ/${photo.exif.aperture}` : null} />
                      <ExifRow label="ISO" value={photo.exif.iso} />
                      <ExifRow label="Shutter" value={photo.exif.shutterSpeed} />
                      <ExifRow label="Resolution" value={photo.exif.width && photo.exif.height ? `${photo.exif.width} × ${photo.exif.height}` : null} />
                    </div>
                  </div>
                )}

                {/* File info */}
                <div>
                  <p className="text-[11px] text-slate-600 uppercase tracking-widest font-semibold mb-2">File</p>
                  <div className="bg-surface rounded-xl border border-surface-border px-3 py-1">
                    <ExifRow label="Type" value={photo.mediaType} />
                    <ExifRow label="MIME" value={photo.mimeType} />
                    <ExifRow label="Size" value={`${(photo.size / 1024 / 1024).toFixed(2)} MB`} />
                    <ExifRow label="Uploaded" value={format(new Date(photo.createdAt), 'PPP')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer actions */}
          {photo && (
            <div className="p-4 border-t border-surface-border shrink-0 space-y-2">
              {/* Album & Edit row */}
              <div className="flex gap-2">
                {onOpenEdit && (
                  <button
                    onClick={() => { onClose(); onOpenEdit(id); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                               border border-surface-border text-slate-400 text-xs hover:text-white
                               hover:border-accent/40 transition-all"
                  >
                    <PenLine size={13} /> Edit
                  </button>
                )}
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10
                           transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting…' : 'Delete photo'}
              </button>
            </div>
          )}
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
