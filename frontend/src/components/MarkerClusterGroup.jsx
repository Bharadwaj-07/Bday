/**
 * Imperative wrapper around leaflet.markercluster.
 * Creates L.Marker instances directly instead of bridging React-Leaflet markers.
 */
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { createPinIcon } from './PhotoMarker';

export default function MarkerClusterGroup({ pins, onPinClick }) {
  const map = useMap();
  const clusterRef = useRef(null);
  const markersRef = useRef(new Map()); // pinId -> L.Marker

  // Create cluster group once
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      iconCreateFunction(c) {
        const count = c.getChildCount();
        const size  = count < 10 ? 40 : count < 100 ? 48 : 56;
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            background:linear-gradient(135deg, rgba(99,102,241,0.85), rgba(168,85,247,0.85));
            border:2px solid rgba(165,180,252,0.4);
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:800;font-size:${count<10?14:12}px;
            font-family:Inter,sans-serif;
            box-shadow:0 4px 20px rgba(99,102,241,0.4), 0 0 40px rgba(99,102,241,0.15);
            backdrop-filter:blur(4px);">${count}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;
    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [map]);

  // Sync markers whenever pins or onPinClick changes
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    const currentIds = new Set(pins.map(p => p._id));

    // Remove markers for pins that no longer exist
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        cluster.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Add or update markers
    for (const pin of pins) {
      if (markersRef.current.has(pin._id)) {
        const marker = markersRef.current.get(pin._id);
        marker.setLatLng([pin.lat, pin.lng]);
        marker.setIcon(createPinIcon(pin));
        marker.off('click');
        marker.on('click', () => onPinClick(pin));
      } else {
        const marker = L.marker([pin.lat, pin.lng], { icon: createPinIcon(pin) });
        marker.on('click', () => onPinClick(pin));
        cluster.addLayer(marker);
        markersRef.current.set(pin._id, marker);
      }
    }
  }, [pins, onPinClick]);

  return null;
}
