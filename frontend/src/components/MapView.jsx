import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet';
import MarkerClusterGroup from './MarkerClusterGroup';

// ── Click handler component ──────────────────────────────────────────────────
function MapClickHandler({ isPlacingPin, onMapClick }) {
  useMapEvents({
    click(e) {
      if (isPlacingPin) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Fly-to handler component ─────────────────────────────────────────────────
function FlyToHandler({ flyToLocation }) {
  const map = useMapEvents({});
  const prevRef = useRef(null);

  useEffect(() => {
    if (!flyToLocation) return;
    // Only fly if the target changed
    if (
      prevRef.current &&
      prevRef.current.lat === flyToLocation.lat &&
      prevRef.current.lng === flyToLocation.lng &&
      prevRef.current.ts === flyToLocation.ts
    ) return;
    prevRef.current = flyToLocation;
    map.flyTo([flyToLocation.lat, flyToLocation.lng], 14, { duration: 1.2 });
  }, [flyToLocation, map]);

  return null;
}

// ── Main Map ──────────────────────────────────────────────────────────────────
export default function MapView({ pins, pinsLoading, isPlacingPin, onMapClick, onPinClick, flyToLocation }) {
  const mapRef = useRef(null);

  // Auto-fit bounds when pins load
  useEffect(() => {
    if (!mapRef.current || !pins.length) return;
    const validPins = pins.filter(p => p.lat && p.lng);
    if (!validPins.length) return;
    const bounds = L.latLngBounds(validPins.map(p => [p.lat, p.lng]));
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
  }, [pins]);

  return (
    <div className="w-full h-full relative">
      {pinsLoading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center
                        bg-surface/60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-3 glass px-5 py-3 rounded-full">
            <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm text-slate-300">Loading map…</span>
          </div>
        </div>
      )}

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={19}
        zoomControl={false}
        className="w-full h-full"
        ref={mapRef}
        worldCopyJump
      >
        {/* ── Dark tile layer (CartoDB Dark Matter – free, no API key) ──────── */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {/* ── Zoom control ────────────────────────────────────────────────── */}
        <ZoomControl position="bottomleft" />

        {/* ── Click handler ───────────────────────────────────────────────── */}
        <MapClickHandler isPlacingPin={isPlacingPin} onMapClick={onMapClick} />

        {/* ── Fly-to handler ──────────────────────────────────────────────── */}
        <FlyToHandler flyToLocation={flyToLocation} />

        {/* ── Clustered markers (imperative) ──────────────────────────────── */}
        <MarkerClusterGroup pins={pins} onPinClick={onPinClick} />
      </MapContainer>

      {/* ── Map vignette overlay for depth ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-[400]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(15,17,23,0.4) 100%)',
        }}
      />
    </div>
  );
}
