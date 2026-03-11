import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, MousePointerClick, Navigation, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { photosApi } from '../services/api';

export default function ManualPinModal({ photo, coords, allPins = [], onClose, onSaved, onPickOnMap }) {
  const [lat, setLat]     = useState(coords?.lat?.toFixed(6) ?? '');
  const [lng, setLng]     = useState(coords?.lng?.toFixed(6) ?? '');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPinList, setShowPinList] = useState(false);
  const [pinSearch, setPinSearch] = useState('');

  // Filter existing pins based on search
  const filteredPins = allPins.filter(p => {
    if (!pinSearch.trim()) return true;
    const q = pinSearch.toLowerCase();
    return (p.label || '').toLowerCase().includes(q)
      || `${p.lat}, ${p.lng}`.includes(q);
  });

  const selectExistingPin = (pin) => {
    setLat(pin.lat.toFixed(6));
    setLng(pin.lng.toFixed(6));
    setLabel(pin.label || '');
    setShowPinList(false);
    setPinSearch('');
  };

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN) || Math.abs(latN) > 90 || Math.abs(lngN) > 180) {
      toast.error('Enter valid coordinates (lat \u00B190, lng \u00B1180)');
      return;
    }
    setSaving(true);
    try {
      await photosApi.setLocation(photo.id || photo._id, latN, lngN, label || undefined);
      toast.success('Pin saved!');
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative glass rounded-2xl w-full max-w-md shadow-2xl"
          initial={{ scale: 0.95, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-pin-manual" />
              <h2 className="font-semibold text-white text-sm">Place Pin</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-surface-hover">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Photo name */}
            <div className="px-3 py-2 bg-surface rounded-xl border border-surface-border">
              <p className="text-xs text-slate-500">Photo</p>
              <p className="text-sm text-white font-medium truncate mt-0.5">
                {photo.originalName || photo.filename}
              </p>
            </div>

            {/* No GPS info */}
            <div className="flex items-start gap-2 p-3 bg-pin-manual/10 border border-pin-manual/30 rounded-xl">
              <span className="text-pin-manual mt-0.5">\u26A0</span>
              <p className="text-xs text-pin-manual leading-relaxed">
                No GPS found in this file. Pick from an existing pin, click on the map, or type coordinates below.
              </p>
            </div>

            {/* ── Use Existing Pin ─────────────────────────── */}
            {allPins.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPinList(s => !s)}
                  className="w-full flex items-center justify-between gap-2 py-3 px-4 rounded-xl
                             border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-sm
                             hover:bg-indigo-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Navigation size={15} />
                    <span>Use existing pin location</span>
                    <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded-full text-indigo-200">
                      {allPins.length}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${showPinList ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showPinList && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border border-surface-border rounded-xl bg-surface overflow-hidden">
                        {/* Search */}
                        {allPins.length > 3 && (
                          <div className="p-2 border-b border-surface-border">
                            <div className="relative">
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                value={pinSearch}
                                onChange={e => setPinSearch(e.target.value)}
                                placeholder="Search pins..."
                                className="w-full bg-surface-hover border border-surface-border rounded-lg pl-8 pr-3 py-1.5
                                           text-xs text-white placeholder-slate-600 outline-none
                                           focus:border-accent/60 transition-colors"
                                autoFocus
                              />
                            </div>
                          </div>
                        )}
                        {/* Pin list */}
                        <div className="max-h-40 overflow-y-auto">
                          {filteredPins.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-slate-500 text-center">No pins found</div>
                          ) : (
                            filteredPins.map((pin, i) => (
                              <button
                                key={pin.id || i}
                                onClick={() => selectExistingPin(pin)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover
                                           transition-colors text-left border-b border-surface-border last:border-0"
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                                               ${pin.locationSource === 'exif'
                                                 ? 'bg-green-500/15 text-green-400'
                                                 : 'bg-amber-500/15 text-amber-400'}`}>
                                  <MapPin size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white font-medium truncate">
                                    {pin.label || `${pin.lat.toFixed(4)}\u00B0, ${pin.lng.toFixed(4)}\u00B0`}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                                    {pin.photoCount > 0 && ` \u00B7 ${pin.photoCount} photo${pin.photoCount !== 1 ? 's' : ''}`}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Map click option */}
            {onPickOnMap && (
              <button
                onClick={onPickOnMap}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                           border border-accent/40 bg-accent/10 text-accent-light text-sm
                           hover:bg-accent/20 transition-colors"
              >
                <MousePointerClick size={16} />
                Click to pick on map
              </button>
            )}

            {/* Manual coord entry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Latitude</label>
                <input
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  placeholder="e.g. 40.7128"
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2
                             text-sm text-white placeholder-slate-600 outline-none
                             focus:border-accent/60 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Longitude</label>
                <input
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  placeholder="e.g. -74.0060"
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2
                             text-sm text-white placeholder-slate-600 outline-none
                             focus:border-accent/60 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Location label (optional)</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. New York City"
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2
                           text-sm text-white placeholder-slate-600 outline-none
                           focus:border-accent/60 transition-colors"
              />
            </div>

            {/* Selected pin indicator */}
            {lat && lng && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-xl">
                <MapPin size={12} className="text-accent-light shrink-0" />
                <p className="text-xs text-accent-light font-mono">
                  {parseFloat(lat).toFixed(6)}\u00B0, {parseFloat(lng).toFixed(6)}\u00B0
                  {label && <span className="text-white/60 ml-1.5 font-sans">\u2014 {label}</span>}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-surface-border text-slate-400
                           hover:text-white hover:border-slate-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!lat && !lng)}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-dark transition-colors
                           text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving\u2026' : 'Save Pin'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
