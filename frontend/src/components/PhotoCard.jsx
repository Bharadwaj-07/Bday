import { MapPin, MapPinOff, Video, PenLine } from 'lucide-react';
import { photosApi } from '../services/api';
import { format } from 'date-fns';

const SOURCE_STYLES = {
  exif:   'text-pin-exif',
  manual: 'text-pin-manual',
  none:   'text-slate-600',
};

export default function PhotoCard({ photo, onClick, onSetPin, onOpenEdit }) {
  const hasPin = photo.locationSource !== 'none';

  return (
    <div
      className="group flex items-center gap-3 p-2 rounded-xl bg-surface hover:bg-surface-hover
                 border border-transparent hover:border-surface-border transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-hover relative">
        {photo.mediaType === 'video' ? (
          <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-800">🎬</div>
        ) : (
          <>
            <img
              src={photosApi.fileUrl(photo._id)}
              alt={photo.title || photo.originalName}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </>
        )}
        {photo.mediaType === 'video' && (
          <Video size={10} className="absolute bottom-1 right-1 text-white" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-tight">
          {photo.title || photo.originalName}
        </p>
        {photo.locationLabel && (
          <p className="text-[11px] text-slate-500 truncate">{photo.locationLabel}</p>
        )}
        <p className="text-[11px] text-slate-600 mt-0.5">
          {photo.exif?.dateTaken
            ? format(new Date(photo.exif.dateTaken), 'MMM d, yyyy')
            : format(new Date(photo.createdAt), 'MMM d, yyyy')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {/* Row: album + edit icons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onOpenEdit && (
            <button title="Edit" onClick={e => { e.stopPropagation(); onOpenEdit(); }}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-surface-border transition-colors">
              <PenLine size={12} />
            </button>
          )}
          {!hasPin && (
            <button title="Place pin manually" onClick={e => { e.stopPropagation(); onSetPin(); }}
              className="p-1 rounded text-pin-manual hover:bg-pin-manual/10 transition-colors">
              <MapPinOff size={12} />
            </button>
          )}
        </div>
        {hasPin && (
          <MapPin size={13} className={SOURCE_STYLES[photo.locationSource]} />
        )}
        {photo.locationSource !== 'none' && (
          <span className={`text-[9px] uppercase tracking-wider font-semibold ${SOURCE_STYLES[photo.locationSource]}`}>
            {photo.locationSource}
          </span>
        )}
      </div>
    </div>
  );
}
