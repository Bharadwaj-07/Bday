import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Trash2, Edit3, Check, X, Navigation, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { pinsApi } from '../services/api';

const PIN_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6',
  '#f97316', '#14b8a6', '#a855f7', '#e11d48',
];

/* ── Reusable category tag input ──────────────────────────────────────── */
function CategoryInput({ categories, onChange, allCategories = [] }) {
  const [input, setInput] = useState('');
  const suggestions = allCategories.filter(
    c => c.includes(input.toLowerCase().trim()) && !categories.includes(c)
  );
  const add = (val) => {
    const clean = val.trim().toLowerCase();
    if (clean && !categories.includes(clean)) onChange([...categories, clean]);
    setInput('');
  };
  const remove = (cat) => onChange(categories.filter(c => c !== cat));
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && categories.length) {
      remove(categories[categories.length - 1]);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {categories.map(cat => (
          <span key={cat} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
            bg-indigo-500/15 text-indigo-300 border border-indigo-400/20">
            {cat}
            <button type="button" onClick={() => remove(cat)} className="hover:text-white">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={categories.length ? 'Add more…' : 'Type category + Enter'}
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5
                     text-xs text-white placeholder-slate-600 outline-none focus:border-accent/60 transition-colors"
        />
        {input.trim() && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 glass rounded-lg border border-surface-border shadow-xl max-h-28 overflow-y-auto">
            {suggestions.slice(0, 6).map(s => (
              <button key={s} type="button" onClick={() => add(s)}
                className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-surface-hover hover:text-white transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PinsManager({ pins, onRefresh, onStartPlacing, placingPin, onFlyToPin }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [editCategories, setEditCategories] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // New pin form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newCategories, setNewCategories] = useState([]);
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [creatingByCoords, setCreatingByCoords] = useState(false);

  // Category filter
  const [filterCategory, setFilterCategory] = useState('');

  // All known categories (derived from pins)
  const allCategories = useMemo(() => {
    const set = new Set();
    pins.forEach(p => (p.categories || []).forEach(c => set.add(c)));
    return [...set].sort();
  }, [pins]);

  // Filtered pins
  const filteredPins = useMemo(() => {
    if (!filterCategory) return pins;
    return pins.filter(p => (p.categories || []).includes(filterCategory));
  }, [pins, filterCategory]);

  const startEdit = useCallback((pin) => {
    setEditingId(pin._id);
    setEditName(pin.name);
    setEditDesc(pin.description || '');
    setEditColor(pin.color || '#6366f1');
    setEditCategories(pin.categories || []);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editName.trim()) return toast.error('Name is required');
    try {
      await pinsApi.update(editingId, {
        name: editName.trim(), description: editDesc.trim(),
        color: editColor, categories: editCategories,
      });
      toast.success('Pin updated!');
      setEditingId(null);
      onRefresh();
    } catch (err) { toast.error(err.message); }
  }, [editingId, editName, editDesc, editColor, editCategories, onRefresh]);

  const deletePin = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await pinsApi.delete(id);
      toast.success('Pin deleted');
      onRefresh();
    } catch (err) { toast.error(err.message); }
    finally { setDeletingId(null); }
  }, [onRefresh]);

  const handleStartPlacing = () => {
    if (!newName.trim()) return toast.error('Enter a name for the pin first');
    onStartPlacing({ name: newName.trim(), color: newColor, categories: newCategories });
  };

  const handleCreateByCoords = useCallback(async () => {
    if (!newName.trim()) return toast.error('Enter a name for the pin first');
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (isNaN(lat) || isNaN(lng)) return toast.error('Enter valid latitude and longitude');
    if (Math.abs(lat) > 90) return toast.error('Latitude must be between -90 and 90');
    if (Math.abs(lng) > 180) return toast.error('Longitude must be between -180 and 180');
    setCreatingByCoords(true);
    try {
      await pinsApi.create({ name: newName.trim(), color: newColor, categories: newCategories, lat, lng });
      toast.success(`Pin "${newName.trim()}" created!`);
      setNewName(''); setNewLat(''); setNewLng(''); setNewCategories([]);
      onRefresh();
    } catch (err) { toast.error(err.message); }
    finally { setCreatingByCoords(false); }
  }, [newName, newColor, newCategories, newLat, newLng, onRefresh]);

  return (
    <div className="flex flex-col h-full">
      {/* Add new pin section */}
      <div className="px-4 pt-4 pb-3 space-y-3 shrink-0 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Plus size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Add New Pin</span>
        </div>

        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Pin name (e.g. Eiffel Tower)"
            className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2
                       text-sm text-white placeholder-slate-600 outline-none focus:border-accent/60 transition-colors"
          />
          <div className="relative">
            <button
              onClick={() => setShowNewColorPicker(s => !s)}
              className="w-10 h-10 rounded-lg border border-surface-border flex items-center justify-center hover:border-white/30 transition-colors"
              style={{ background: newColor + '30' }}
            >
              <div className="w-5 h-5 rounded-full" style={{ background: newColor }} />
            </button>
            {showNewColorPicker && (
              <div className="absolute right-0 top-12 z-50 glass rounded-xl p-2 grid grid-cols-4 gap-1.5 shadow-2xl">
                {PIN_COLORS.map(c => (
                  <button key={c} onClick={() => { setNewColor(c); setShowNewColorPicker(false); }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      newColor === c ? 'border-white scale-110' : 'border-transparent'
                    }`} style={{ background: c }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lat/Lng coordinate inputs */}
        <div className="flex gap-2">
          <input
            value={newLat}
            onChange={e => setNewLat(e.target.value)}
            placeholder="Latitude"
            type="number"
            step="any"
            className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2
                       text-sm text-white placeholder-slate-600 outline-none focus:border-accent/60 transition-colors
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <input
            value={newLng}
            onChange={e => setNewLng(e.target.value)}
            placeholder="Longitude"
            type="number"
            step="any"
            className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2
                       text-sm text-white placeholder-slate-600 outline-none focus:border-accent/60 transition-colors
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Categories</label>
          <CategoryInput categories={newCategories} onChange={setNewCategories} allCategories={allCategories} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleStartPlacing}
            disabled={placingPin || creatingByCoords}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              placingPin
                ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300 animate-pulse'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25'
            }`}
          >
            <MapPin size={15} />
            {placingPin ? 'Click map…' : 'Drop on Map'}
          </button>
          <button
            onClick={handleCreateByCoords}
            disabled={creatingByCoords || placingPin || !newLat || !newLng}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                       bg-surface border border-surface-border text-white hover:bg-surface-hover hover:border-accent/40
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Navigation size={14} />
            {creatingByCoords ? 'Creating…' : 'Use Lat/Lng'}
          </button>
        </div>
      </div>

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {/* Category filter */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2 px-1">
            <Filter size={11} className="text-slate-500 shrink-0" />
            <button onClick={() => setFilterCategory('')}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                !filterCategory ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300' : 'border-surface-border text-slate-500 hover:text-white'
              }`}>All</button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(f => f === cat ? '' : cat)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterCategory === cat ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300' : 'border-surface-border text-slate-500 hover:text-white'
                }`}>{cat}</button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold px-1 mb-1">
          {filteredPins.length} pin{filteredPins.length !== 1 ? 's' : ''}{filterCategory ? ` in "${filterCategory}"` : ''}
        </p>

        {filteredPins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-3">
            <MapPin size={32} strokeWidth={1} />
            <p className="text-sm">No pins yet</p>
            <p className="text-xs text-slate-700">Add a name above and click the map</p>
          </div>
        )}

        <AnimatePresence>
          {filteredPins.map((pin) => (
            <motion.div
              key={pin._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group rounded-xl border border-surface-border bg-surface hover:bg-surface-hover transition-all overflow-hidden"
            >
              {editingId === pin._id ? (
                /* Edit mode */
                <div className="p-3 space-y-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent/60" />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                    placeholder="Description (optional)"
                    className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent/60 resize-none" />
                  <CategoryInput categories={editCategories} onChange={setEditCategories} allCategories={allCategories} />
                  <div className="flex items-center gap-1.5">
                    {PIN_COLORS.slice(0, 6).map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                          editColor === c ? 'border-white scale-110' : 'border-transparent'
                        }`} style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-surface-border transition-colors">
                      <X size={14} />
                    </button>
                    <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent-dark transition-colors">
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => onFlyToPin(pin)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{ background: `${pin.color || '#6366f1'}25`, boxShadow: `0 4px 12px ${pin.color || '#6366f1'}20` }}>
                    <MapPin size={16} style={{ color: pin.color || '#6366f1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{pin.name}</p>
                    {pin.description && <p className="text-[11px] text-slate-500 truncate">{pin.description}</p>}
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                      {pin.lat?.toFixed(4)}°, {pin.lng?.toFixed(4)}°
                    </p>
                    <div className="flex gap-2 mt-1">
                      {pin.photoIds?.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-400/20">
                          {pin.photoIds.length} photo{pin.photoIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {pin.musicIds?.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20">
                          {pin.musicIds.length} song{pin.musicIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {pin.categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pin.categories.map(cat => (
                          <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-400/20">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(pin)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-surface-border transition-colors">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => deletePin(pin._id)} disabled={deletingId === pin._id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
