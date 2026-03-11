import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

api.interceptors.response.use(
  res => res,
  error => {
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

export const photosApi = {
  /** Upload one photo/video file. Returns the saved photo object. */
  upload: (file) => uploadSingleFile('/api/photos/upload', 'file', file),
  getAll: (params = {}) => api.get('/photos', { params }),
  getCategories: () => api.get('/photos/categories'),
  getOne: id => api.get(`/photos/${id}`),
  fileUrl: id => `/api/photos/${id}/file`,
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
  upload: (file) => uploadSingleFile('/api/music/upload', 'file', file),
  fileUrl: id => `/api/music/${id}/file`,
  delete: id => api.delete(`/music/${id}`),
};

export const statsApi = { get: () => api.get('/stats') };
export default api;
