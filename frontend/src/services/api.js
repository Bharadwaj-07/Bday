import axios from 'axios';

const BASE = (import.meta.env.VITE_API_URL || window.location.origin || '').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'photomap_auth_token';

export function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearStoredToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 120000,
});

if (!import.meta.env.VITE_API_URL && BASE === window.location.origin) {
  console.info('PhotoMap is using the current Netlify/Vite origin as the API base. Set VITE_API_URL for a separate backend host.');
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent('photomap:logout'));
    }
    const message = error.response?.data?.error || error.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

/**
 * Upload a single file using raw fetch (avoids axios/multipart quirks).
 * Returns the parsed JSON response.
 */
async function uploadSingleFile(url, fieldName, file) {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(url, { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json;
}

export const authApi = {
  googleLogin: (idToken) => api.post('/auth/google', { idToken }),
  getMe: () => api.get('/auth/me'),
};

export const photosApi = {
  /** Upload one photo/video file. Returns the saved photo object. */
  upload: (file) => uploadSingleFile(`${BASE}/api/photos/upload`, 'file', file),
  getAll: (params = {}) => api.get('/photos', { params }),
  getCategories: () => api.get('/photos/categories'),
  getOne: id => api.get(`/photos/${id}`),
  fileUrl: id => `${BASE}/api/photos/${id}/file`,
  update: (id, data) => api.patch(`/photos/${id}`, data),
  delete: id => api.delete(`/photos/${id}`),
};

export const pinsApi = {
  getAll:       ()           => api.get('/pins'),
  create:       (data)       => api.post('/pins', data),
  update:       (id, data)   => api.patch(`/pins/${id}`, data),
  delete:       (id)         => api.delete(`/pins/${id}`),
  getCategories:()           => api.get('/pins/categories'),
  linkPhotos:   (id, photoIds)=> api.post(`/pins/${id}/link-photos`, { photoIds }),
  unlinkPhoto:  (id, photoId) => api.post(`/pins/${id}/unlink-photo`, { photoId }),
  linkMusic:    (id, musicIds)=> api.post(`/pins/${id}/link-music`, { musicIds }),
  unlinkMusic:  (id, musicId) => api.post(`/pins/${id}/unlink-music`, { musicId }),
};

export const musicApi = {
  getAll: () => api.get('/music'),
  /** Upload one music file. Returns the saved music object. */
  upload: (file) => uploadSingleFile(`${BASE}/api/music/upload`, 'file', file),
  fileUrl: id => `${BASE}/api/music/${id}/file`,
  delete: id => api.delete(`/music/${id}`),
};

export const statsApi = { get: () => api.get('/stats') };
export default api;
