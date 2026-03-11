import { useState, useCallback } from 'react';
import { Search, SlidersHorizontal, RefreshCw, MapPinOff, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotos } from '../hooks/usePhotos';
import PhotoCard from './PhotoCard';

export default function Sidebar({ onPhotoClick, onSetPin, onRefresh, onOpenEdit }) {
  const [search, setSearch]           = useState('');
  const [filterMode, setFilterMode]   = useState('all'); // 'all' | 'withpin' | 'nopin'
  const [mediaFilter, setMediaFilter] = useState('');    // '' | 'photo' | 'video'

  const filters = {
    ...(filterMode === 'withpin' && { withLocation: 'true' }),
    ...(filterMode === 'nopin'   && { withLocation: 'false' }),
    ...(mediaFilter               && { mediaType: mediaFilter }),
  };

  const { photos, total, loading, refetch } = usePhotos(filters);

  const displayed = search.trim()
    ? photos.filter(p =>
        (p.title?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (p.originalName?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (p.locationLabel?.toLowerCase() || '').includes(search.toLowerCase())
      )
    : photos;

  const handleRefresh = useCallback(() => { refetch(); onRefresh?.(); }, [refetch, onRefresh]);

  return (
    <aside className="w-80 flex flex-col border-l border-surface-border bg-surface-card overflow-hidden shrink-0">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-white">Library</h2>
          <div className="flex gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-surface-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search photos…"
            className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-3 py-2
                       text-sm text-white placeholder-slate-600 outline-none
                       focus:border-accent/60 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {[['all','All'],['withpin','Pinned'],['nopin','No pin']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilterMode(k)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors
                ${filterMode === k
                  ? 'bg-accent/20 border-accent/50 text-accent-light'
                  : 'border-surface-border text-slate-500 hover:text-slate-200'}`}
            >
              {k === 'nopin' && <MapPinOff size={11} className="inline mr-1" />}
              {k === 'withpin' && <MapPin size={11} className="inline mr-1" />}
              {l}
            </button>
          ))}
          {[['photo','Photos'],['video','Videos']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMediaFilter(mediaFilter === k ? '' : k)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors
                ${mediaFilter === k
                  ? 'bg-surface-hover border-surface-border text-white'
                  : 'border-surface-border text-slate-500 hover:text-slate-200'}`}
            >
              {l}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-slate-600">{displayed.length} of {total}</p>
      </div>

      {/* ── Photo list ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {loading && (
          <div className="space-y-2 mt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />
            ))}
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm gap-2">
            <SlidersHorizontal size={24} />
            <p>No photos found</p>
          </div>
        )}

        <AnimatePresence>
          {!loading && displayed.map(photo => (
            <motion.div
              key={photo._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PhotoCard
                photo={photo}
                onClick={() => onPhotoClick(photo._id)}
                onSetPin={() => onSetPin(photo)}
                onOpenEdit={onOpenEdit ? () => onOpenEdit(photo._id) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
