export const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type Session = { id: number; label: string; start_time: string; end_time: string; sort_order: number };
export type WeddingImage = {
  id: number;
  kind: 'cover' | 'gallery';
  path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  alt_text: string;
};
export type Wedding = {
  id: number;
  slug: string;
  bride: string;
  groom: string;
  event_date: string;
  location: string;
  story: string;
  cover_url: string;
  deadline?: string | null;
  sessions: Session[];
  images: WeddingImage[];
};
export type Attendance = 'yes' | 'no' | 'maybe';
export type RSVP = {
  id: number;
  name: string;
  attendance: Attendance;
  guests_count: number;
  message: string;
  checked_in_at?: string | null;
  session?: Session;
  created_at: string;
};
export type Stats = { total: number; yes: number; no: number; maybe: number; guests: number };
export type SearchResult = { id: number; name: string; guests_count: number; checked_in_at?: string | null };

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(API + path, { ...init, headers });
  } catch {
    throw new ApiError('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || `Permintaan gagal (${response.status})`);
  return body as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, {}, token),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
  put: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, token),
  del: <T>(path: string, token?: string) => request<T>(path, { method: 'DELETE' }, token),
  upload: <T>(path: string, form: FormData, token: string) =>
    request<T>(path, { method: 'POST', body: form }, token),
};

export const assetUrl = (path: string) => (!path ? '' : path.startsWith('http') ? path : API + path);
export const coverOf = (wedding: Wedding) =>
  wedding.cover_url ? assetUrl(wedding.cover_url) : wedding.images.find(image => image.kind === 'cover')?.path
    ? assetUrl(wedding.images.find(image => image.kind === 'cover')!.path)
    : '';
export const galleryOf = (wedding: Wedding) =>
  wedding.images.filter(image => image.kind === 'gallery').map(image => ({ ...image, url: assetUrl(image.path) }));

export const couple = (wedding: Wedding) => `${wedding.bride} & ${wedding.groom}`;
export const fullDate = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(value));
export const clock = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value));
export const dateInput = (value: string) => new Date(value).toISOString().slice(0, 10);
