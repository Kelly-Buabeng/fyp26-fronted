import { z } from 'zod';
import * as s from './schemas';
import { ApiError, parseApiError } from './errors';
import type {
  DetectionInput,
  DetectionResponse,
  ExportFormat,
  QueryOptions,
  UploadOptions,
} from './types';

const BASE = '/api/backend';
function query(options: QueryOptions = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(options)) if (v !== undefined) p.set(k, String(v));
  return p.size ? `?${p}` : '';
}
async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE + path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(data, response.status);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError('The backend returned an unexpected response.', 502);
  return parsed.data;
}
export const getServiceInfo = () => request('/service', s.serviceSchema);
export const getHealth = () => request('/health', s.healthSchema);
export const getStorageMode = () => request('/mode', z.object({ mock_mode: z.boolean() }));
export const getHeatmap = (options?: QueryOptions) =>
  request('/heatmap' + query(options), s.heatmapSchema);
export const getStats = () => request('/stats', s.statsSchema);
export const getRegionalReport = (options?: QueryOptions) =>
  request('/report' + query(options), s.reportSchema);
export const deleteDetection = (id: string) =>
  request('/detections/' + encodeURIComponent(id), s.deleteSchema, { method: 'DELETE' });
export async function exportDetections(
  format: ExportFormat,
  options?: QueryOptions,
): Promise<Blob> {
  const params = new URLSearchParams(query(options).slice(1));
  params.set('format', format);
  const response = await fetch(`${BASE}/detections/export?${params}`, { cache: 'no-store' });
  if (!response.ok) throw parseApiError(await response.json().catch(() => null), response.status);
  return response.blob();
}
export async function getSavedDetections(options?: QueryOptions) {
  const blob = await exportDetections('geojson', options);
  const parsed = s.geojsonSchema.safeParse(JSON.parse(await blob.text()));
  if (!parsed.success)
    throw new ApiError('The exported detections have an unexpected format.', 502);
  return parsed.data.features.map((f) => ({
    ...f.properties,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}
export function detectImage(
  input: DetectionInput,
  options: UploadOptions = {},
): Promise<DetectionResponse> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Upload cancelled.', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => options.signal?.removeEventListener('abort', abort);
    xhr.open('POST', BASE + '/detect');
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => options.onUploaded?.();
    xhr.onerror = () => {
      cleanup();
      reject(new ApiError('Unable to reach the server. Check your connection.', 0));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(
        new ApiError(
          'Detection timed out. Check whether the request was saved before retrying.',
          504,
        ),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    };
    xhr.onload = () => {
      cleanup();
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiError('The server returned an unreadable response.', 502));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(parseApiError(data, xhr.status));
        return;
      }
      const result = s.detectionResponseSchema.safeParse(data);
      if (!result.success) {
        reject(new ApiError('The backend returned an unexpected detection response.', 502));
        return;
      }
      resolve(result.data);
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    const form = new FormData();
    form.set('image', input.image);
    form.set('lat', String(input.lat));
    form.set('lng', String(input.lng));
    form.set('device_id', input.device_id || 'manual');
    xhr.send(form);
  });
}
