import { Marker } from 'react-leaflet';
import L from 'leaflet';

// ── Beautiful pin icon with glow and linked-item badges ────────────────────────
export function createPinIcon(pin) {
  const color = pin.color || '#6366f1';
  const photoCount = pin.photoIds?.length || 0;
  const musicCount = pin.musicIds?.length || 0;
  const hasPhotos = photoCount > 0;
  const hasMusic = musicCount > 0;
  const initial = (pin.name || '?')[0].toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="62" viewBox="0 0 48 62">
      <defs>
        <filter id="glow-${pin._id}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="grad-${pin._id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.7" />
        </linearGradient>
        <filter id="shadow-${pin._id}" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="${color}" flood-opacity="0.4"/>
        </filter>
      </defs>
      <!-- Pin body -->
      <path d="M24 2C13.5 2 5 10.5 5 21c0 14 19 38 19 38S43 35 43 21C43 10.5 34.5 2 24 2z"
            fill="url(#grad-${pin._id})" filter="url(#shadow-${pin._id})"
            stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      <!-- Inner circle -->
      <circle cx="24" cy="20" r="11" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <!-- Initial letter -->
      <text x="24" y="24.5" text-anchor="middle" font-size="13" fill="white"
            font-family="Inter,system-ui,sans-serif" font-weight="800">${initial}</text>
      ${hasPhotos ? `
        <circle cx="38" cy="10" r="8" fill="#06b6d4" stroke="#0e1117" stroke-width="2"/>
        <text x="38" y="14" text-anchor="middle" font-size="9" fill="white"
              font-family="Inter,sans-serif" font-weight="700">${photoCount > 9 ? '9+' : photoCount}</text>
      ` : ''}
      ${hasMusic ? `
        <circle cx="${hasPhotos ? 10 : 38}" cy="${hasPhotos ? 10 : 10}" r="7" fill="#a855f7" stroke="#0e1117" stroke-width="2"/>
        <text x="${hasPhotos ? 10 : 38}" y="13.5" text-anchor="middle" font-size="10" fill="white">♫</text>
      ` : ''}
    </svg>`;

  return L.divIcon({
    html: svg,
    className: 'pin-marker',
    iconSize:   [48, 62],
    iconAnchor: [24, 62],
    popupAnchor:[0, -62],
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PhotoMarker({ pin, onPinClick }) {
  const icon = createPinIcon(pin);

  return (
    <Marker
      position={[pin.lat, pin.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onPinClick(pin),
      }}
    />
  );
}
