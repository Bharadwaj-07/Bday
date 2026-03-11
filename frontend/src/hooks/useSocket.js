/**
 * useSocket.js
 * Connects to the Socket.io server and provides real-time events
 * for photos, pins, and music.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useSocket({
  onPhotoAdded, onPhotoUpdated, onPhotoDeleted,
  onPinAdded, onPinUpdated, onPinDeleted,
  onMusicAdded, onMusicDeleted,
}) {
  const socketRef = useRef(null);
  const cbRefs = useRef({
    onPhotoAdded, onPhotoUpdated, onPhotoDeleted,
    onPinAdded, onPinUpdated, onPinDeleted,
    onMusicAdded, onMusicDeleted,
  });

  // Keep callbacks fresh without reconnecting
  useEffect(() => {
    cbRefs.current = {
      onPhotoAdded, onPhotoUpdated, onPhotoDeleted,
      onPinAdded, onPinUpdated, onPinDeleted,
      onMusicAdded, onMusicDeleted,
    };
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => console.log('🔌 Socket connected'));
    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));

    // Photo events
    socket.on('photo:added',   data => cbRefs.current.onPhotoAdded?.(data));
    socket.on('photo:updated', data => cbRefs.current.onPhotoUpdated?.(data));
    socket.on('photo:deleted', data => cbRefs.current.onPhotoDeleted?.(data));

    // Pin events
    socket.on('pin:added',   data => cbRefs.current.onPinAdded?.(data));
    socket.on('pin:updated', data => cbRefs.current.onPinUpdated?.(data));
    socket.on('pin:deleted', data => cbRefs.current.onPinDeleted?.(data));

    // Music events
    socket.on('music:added',   data => cbRefs.current.onMusicAdded?.(data));
    socket.on('music:deleted', data => cbRefs.current.onMusicDeleted?.(data));

    socketRef.current = socket;
    return () => socket.disconnect();
  }, []);

  return socketRef;
}
