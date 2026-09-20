import { forwardRef, useEffect, useState } from 'react';
import { getStoredToken } from '../services/api';

function isProtectedApiUrl(url) {
  return !!url && typeof url === 'string' && url.includes('/api/');
}

export const ProtectedImage = forwardRef(function ProtectedImage({ src, alt = '', className = '', style, ...props }, ref) {
  const [resolvedSrc, setResolvedSrc] = useState(src || '');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    if (!src || !isProtectedApiUrl(src)) {
      setResolvedSrc(src || '');
      return undefined;
    }

    const token = getStoredToken();

    (async () => {
      try {
        const res = await fetch(src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Media fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setResolvedSrc(src);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img ref={ref} src={resolvedSrc} alt={alt} className={className} style={style} {...props} />;
});

export const ProtectedVideo = forwardRef(function ProtectedVideo({ src, className = '', style, ...props }, ref) {
  const [resolvedSrc, setResolvedSrc] = useState(src || '');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    if (!src || !isProtectedApiUrl(src)) {
      setResolvedSrc(src || '');
      return undefined;
    }

    const token = getStoredToken();

    (async () => {
      try {
        const res = await fetch(src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Video fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } catch {
        if (!cancelled) setResolvedSrc(src);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <video ref={ref} src={resolvedSrc} className={className} style={style} {...props} />;
});
