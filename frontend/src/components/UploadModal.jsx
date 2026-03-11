import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, CheckCircle, AlertCircle, MapPin, MapPinOff } from 'lucide-react';
import { useUpload } from '../hooks/usePhotos';

const ACCEPTED = {
  'image/*': ['.jpg','.jpeg','.png','.heic','.heif','.webp','.tiff'],
  'video/*': ['.mp4','.mov','.avi','.webm'],
};

export default function UploadModal({ onClose, onDone }) {
  const { upload, uploading, progress, results } = useUpload(onDone);

  const onDrop = useCallback(accepted => {
    if (!accepted.length || uploading) return;
    upload(accepted);
  }, [upload, uploading]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!uploading ? onClose : undefined} />

        {/* Modal */}
        <motion.div
          className="relative glass rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <div>
              <h2 className="font-semibold text-white">Upload Photos & Videos</h2>
              <p className="text-xs text-slate-500 mt-0.5">GPS extracted automatically from EXIF data</p>
            </div>
            {!uploading && (
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-surface-hover transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="p-6 space-y-4">
            {/* Drop zone */}
            {results.length === 0 && (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragActive
                    ? 'border-accent bg-accent/10 scale-[1.01]'
                    : 'border-surface-border hover:border-slate-600 hover:bg-surface-hover'}`}
              >
                <input {...getInputProps()} />
                <UploadCloud
                  size={36}
                  className={`mx-auto mb-3 ${isDragActive ? 'text-accent-light' : 'text-slate-600'}`}
                />
                {isDragActive ? (
                  <p className="text-sm text-accent-light font-medium">Drop to upload</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-300 font-medium">
                      Drag & drop photos or videos here
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      or <span className="text-accent-light underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-slate-700 mt-3">
                      JPG · PNG · HEIC · WebP · MP4 · MOV · up to 50 MB each
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Queued files */}
            {acceptedFiles.length > 0 && results.length === 0 && !uploading && (
              <div className="text-xs text-slate-500 text-center">
                {acceptedFiles.length} file{acceptedFiles.length > 1 ? 's' : ''} selected
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Uploading & extracting GPS…</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border
                    ${r.error
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-surface border-surface-border'}`}>
                    {r.error
                      ? <AlertCircle size={16} className="text-red-400 shrink-0" />
                      : r.hasLocation
                        ? <MapPin size={16} className="text-pin-exif shrink-0" />
                        : <MapPinOff size={16} className="text-pin-manual shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{r.originalName}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.error
                          ? r.error
                          : r.hasLocation
                            ? `GPS found · ${r.lat?.toFixed(4)}°, ${r.lng?.toFixed(4)}°`
                            : 'No GPS – place pin manually'}
                      </p>
                    </div>
                    {!r.error && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full
                        ${r.hasLocation
                          ? 'bg-pin-exif/10 text-pin-exif border border-pin-exif/30'
                          : 'bg-pin-manual/10 text-pin-manual border border-pin-manual/30'}`}>
                        {r.hasLocation ? 'auto' : 'manual'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {results.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-dark transition-colors
                             text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
