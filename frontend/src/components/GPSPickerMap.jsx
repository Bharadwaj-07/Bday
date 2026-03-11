import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { photosApi } from '../services/api';

/**
 * GPSPickerMap – standalone Leaflet map (no react-leaflet dependency).
 * Shows all existing pins, lets user click to pick a new location.
 * props: onPick(lat, lng), initialLat, initialLng, pins
 */
export default function GPSPickerMap({ onPick, initialLat, initialLng, pins = [] }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const pickedMarker = useRef(null);
  const [picked, setPicked] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: picked ? [picked.lat, picked.lng] : [20, 0],
      zoom:   picked ? 10 : 2,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // ── Render existing pins ──────────────────────────────────────────────────
    pins.forEach(pin => {
      const color = pin.locationSource === 'exif' ? '#22c55e' : '#f59e0b';
      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="0 0 24 28">
          <path d="M12 1C7.58 1 4 4.58 4 9c0 7 8 18 8 18s8-11 8-18c0-4.42-3.58-8-8-8z"
                fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="3.5" fill="rgba(0,0,0,0.3)"/>
        </svg>`,
        className: '',
        iconSize: [24, 28],
        iconAnchor: [12, 28],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      const label = pin.locationLabel || pin.title || `${pin.lat.toFixed(4)}°, ${pin.lng.toFixed(4)}°`;
      marker.bindTooltip(`<div style="font-size:12px;color:#f8fafc;">${label}</div>`, {
        direction: 'top',
        offset: [0, -28],
        opacity: 0.95,
        className: 'gps-tooltip',
      });
    });

    // ── Picked marker ─────────────────────────────────────────────────────────
    const pickedIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
        <path d="M16 2C9.37 2 4 7.37 4 14c0 9.33 12 24 12 24s12-14.67 12-24C28 7.37 22.63 2 16 2z"
              fill="#6366f1" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
        <circle cx="16" cy="14" r="5" fill="rgba(255,255,255,0.9)"/>
        <circle cx="16" cy="14" r="2.5" fill="#6366f1"/>
      </svg>`,
      className: '',
      iconSize: [32, 38],
      iconAnchor: [16, 38],
    });

    if (picked) {
      pickedMarker.current = L.marker([picked.lat, picked.lng], { icon: pickedIcon, draggable: true }).addTo(map);
      pickedMarker.current.on('dragend', e => {
        const { lat, lng } = e.target.getLatLng();
        const rounded = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
        setPicked(rounded);
        onPick(rounded.lat, rounded.lng);
      });
    }

    // ── Click to place ────────────────────────────────────────────────────────
    map.on('click', e => {
      const { lat, lng } = e.latlng;
      const rounded = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };

      if (pickedMarker.current) {
        pickedMarker.current.setLatLng([rounded.lat, rounded.lng]);
      } else {
        pickedMarker.current = L.marker([rounded.lat, rounded.lng], { icon: pickedIcon, draggable: true }).addTo(map);
        pickedMarker.current.on('dragend', ev => {
          const p = ev.target.getLatLng();
          const r2 = { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
          setPicked(r2);
          onPick(r2.lat, r2.lng);
        });
      }
      setPicked(rounded);
      onPick(rounded.lat, rounded.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
      {picked && (
        <div className="absolute bottom-3 left-3 glass px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 pointer-events-none">
          {picked.lat.toFixed(6)}°, {picked.lng.toFixed(6)}°
        </div>
      )}
      {!picked && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full text-xs text-accent-light pointer-events-none animate-pulse">
          Click anywhere on the map to drop a pin
        </div>
      )}
      <style>{`
        .gps-tooltip {
          background: #171b25 !important;
          border: 1px solid #2a2f40 !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .leaflet-tooltip::before { display: none; }
      `}</style>
    </div>
  );
}
