import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { photosApi, pinsApi, musicApi, statsApi } from '../services/api';

// ── usePins ────────────────────────────────────────────────────────────────────
export function usePins() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await pinsApi.getAll();
      setPins(data.pins || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  return { pins, loading, refetch: fetchPins, setPins };
}

// ── useMusic ───────────────────────────────────────────────────────────────────
export function useMusic() {
  const [music, setMusic] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMusic = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await musicApi.getAll();
      setMusic(data.music || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMusic(); }, [fetchMusic]);

  return { music, loading, refetch: fetchMusic };
}

// ── usePhotos ──────────────────────────────────────────────────────────────────
export function usePhotos(filters = {}) {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const filterStr = JSON.stringify(filters);

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await photosApi.getAll(JSON.parse(filterStr));
      setPhotos(data.photos || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load photos: ' + err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStr]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  return { photos, total, loading, refetch: fetchPhotos };
}

// ── useUpload ──────────────────────────────────────────────────────────────────
export function useUpload(onSuccess) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);

  const upload = useCallback(async files => {
    if (!files?.length) return;
    setUploading(true);
    setProgress(0);
    setResults([]);

    const total = files.length;
    const toastId = toast.loading(`Uploading 0/${total}...`);
    const allResults = [];
    let errors = 0;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      toast.loading(`Uploading ${i + 1}/${total}... ${file.name}`, { id: toastId });
      setProgress(Math.round((i / total) * 100));

      try {
        const result = await photosApi.upload(file);
        allResults.push(result);
      } catch (err) {
        allResults.push({ originalName: file.name, error: err.message });
        errors++;
      }

      setResults([...allResults]);
    }

    const ok = allResults.length - errors;
    toast.success(ok + ' uploaded' + (errors ? ' · ' + errors + ' failed' : ''), { id: toastId, duration: 4000 });
    setProgress(100);
    onSuccess?.(allResults);
    setUploading(false);
  }, [onSuccess]);

  return { upload, uploading, progress, results };
}

// ── useMusicUpload ─────────────────────────────────────────────────────────────
export function useMusicUpload(onSuccess) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async files => {
    if (!files?.length) return;
    setUploading(true);
    setProgress(0);

    const total = files.length;
    const toastId = toast.loading(`Uploading music 0/${total}...`);
    const allResults = [];
    let errors = 0;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      toast.loading(`Uploading ${i + 1}/${total}... ${file.name}`, { id: toastId });
      setProgress(Math.round((i / total) * 100));

      try {
        const result = await musicApi.upload(file);
        allResults.push(result);
      } catch (err) {
        allResults.push({ originalName: file.name, error: err.message });
        errors++;
      }
    }

    const ok = allResults.length - errors;
    toast.success(ok + ' song(s) uploaded' + (errors ? ' · ' + errors + ' failed' : ''), { id: toastId, duration: 3000 });
    setProgress(100);
    onSuccess?.(allResults);
    setUploading(false);
  }, [onSuccess]);

  return { upload, uploading, progress };
}

// ── useStats ───────────────────────────────────────────────────────────────────
export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchStats = useCallback(async () => {
    try { const { data } = await statsApi.get(); setStats(data); } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refetch: fetchStats };
}
