import { forwardRef, useEffect, useState } from 'react';
import { ImageIcon, PlayCircle } from 'lucide-react';
import { getStoredToken } from '../services/api';

function isProtectedApiUrl(url) {
  return !!url && typeof url === 'string' && url.includes('/api/');
}

function MediaFallback({ label, className, style }) {
  return (
    <div
      className={className || 'flex items-center justify-center w-full h-full bg-slate-900 text-slate-500'}
      style={style}
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center px-3">
        <ImageIcon size={20} className="opacity-70" />
        <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">{label}</span>
      </div>
    </div>
  );
}

export const ProtectedImage = forwardRef(function ProtectedImage({ src, alt = '', className = '', style, ...props }, ref) {
  const [resolvedSrc, setResolvedSrc] = useState(src || '');
  const [hasError, setHasError] = useState(false);

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
          setResolvedSrc('');
          setHasError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (hasError || !resolvedSrc) {
    return <MediaFallback label="Media unavailable" className={className} style={style} />;
  }

  return <img ref={ref} src={resolvedSrc} alt={alt} className={className} style={style} {...props} />;
});

export const ProtectedVideo = forwardRef(function ProtectedVideo({ src, className = '', style, ...props }, ref) {
  const [resolvedSrc, setResolvedSrc] = useState(src || '');
  const [hasError, setHasError] = useState(false);

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
        if (!cancelled) {
          setResolvedSrc('');
          setHasError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (hasError || !resolvedSrc) {
    return <MediaFallback label="Video unavailable" className={className} style={style} />;
  }

  return <video ref={ref} src={resolvedSrc} className={className} style={style} {...props} />;
});
