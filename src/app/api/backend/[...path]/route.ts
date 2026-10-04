import { NextResponse } from 'next/server';
import { z } from 'zod';
import { backendRequest } from '@/lib/api/backend.server';
import { assertSameOrigin, HttpError, isAdmin } from '@/lib/server/auth';
import { failure } from '@/lib/server/responses';
import { rateLimit } from '@/lib/server/rate-limit';
import { coordinatesSchema, MAX_IMAGE_BYTES } from '@/lib/validation/detection';
import * as schemas from '@/lib/api/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
type Context = { params: Promise<{ path: string[] }> };
const publicPaths: Record<string, { path: string; schema: z.ZodType }> = {
  service: { path: '/', schema: schemas.serviceSchema },
  health: { path: '/health', schema: schemas.healthSchema },
  heatmap: { path: '/api/v1/heatmap', schema: schemas.heatmapSchema },
  stats: { path: '/api/v1/stats', schema: schemas.statsSchema },
  report: { path: '/api/v1/report', schema: schemas.reportSchema },
};
function filters(request: Request, kind: string) {
  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  const limit = incoming.get('limit');
  const confidence = incoming.get('min_confidence');
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > (kind === 'heatmap' ? 2000 : 20000))
      throw new HttpError(400, 'Invalid detection limit.');
    params.set('limit', String(n));
  }
  if (confidence !== null) {
    const n = Number(confidence);
    if (!Number.isFinite(n) || n < 0 || n > 1)
      throw new HttpError(400, 'Confidence must be between 0 and 1.');
    params.set('min_confidence', String(n));
  }
  return params;
}
export async function GET(request: Request, context: Context) {
  try {
    const path = (await context.params).path.join('/');
    if (['stats', 'report', 'service'].includes(path) && !(await isAdmin()))
      throw new HttpError(401, 'Sign in as authority personnel to access this feature.');
    if (path === 'mode') {
      const response = await backendRequest('/api/v1/stats', { signal: request.signal });
      const result = schemas.statsSchema.safeParse(await response.json());
      if (!result.success) throw new HttpError(502, 'The backend returned an unexpected response.');
      return NextResponse.json(
        { mock_mode: result.data.mock_mode },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (path === 'detections/export') {
      if (!(await isAdmin())) throw new HttpError(401, 'Sign in as RHA to export detections.');
      const format = new URL(request.url).searchParams.get('format') || 'csv';
      if (!['csv', 'geojson'].includes(format)) throw new HttpError(400, 'Choose CSV or GeoJSON.');
      const params = filters(request, 'export');
      params.set('format', format);
      const response = await backendRequest(
        '/api/v1/detections/export?' + params,
        { signal: request.signal },
        true,
      );
      return new Response(response.body, {
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/geo+json',
          'Content-Disposition': `attachment; filename="detections.${format}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const endpoint = Object.hasOwn(publicPaths, path) ? publicPaths[path] : undefined;
    if (!endpoint) throw new HttpError(404, 'Endpoint not found.');
    const params = ['heatmap', 'report'].includes(path)
      ? filters(request, path)
      : new URLSearchParams();
    const response = await backendRequest(endpoint.path + (params.size ? '?' + params : ''), {
      signal: request.signal,
    });
    const result = endpoint.schema.safeParse(await response.json());
    if (!result.success) throw new HttpError(502, 'The backend returned an unexpected response.');
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    if ((await context.params).path.join('/') !== 'detect')
      throw new HttpError(404, 'Endpoint not found.');
    assertSameOrigin(request);
    rateLimit(request, 'detect', 30, 60 * 60 * 1000);
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
      throw new HttpError(415, 'Submit multipart form data.');
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES + 65536)
      throw new HttpError(413, 'Image too large. Max size is 10 MiB.');
    // Bound the actual stream too; do not trust Content-Length for memory safety.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Upload body is missing.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES + 65536) {
        await reader.cancel();
        throw new HttpError(413, 'Upload too large. Max image size is 10 MiB.');
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    let form: FormData;
    try {
      form = await new Request(request.url, {
        method: 'POST',
        headers: { 'content-type': request.headers.get('content-type')! },
        body,
      }).formData();
    } catch {
      throw new HttpError(400, 'Unable to read the upload.');
    }
    const image = form.get('image');
    if (
      !(image instanceof File) ||
      !['image/jpeg', 'image/png'].includes(image.type) ||
      !image.size
    )
      throw new HttpError(400, 'Choose a JPEG or PNG image.');
    if (image.size > MAX_IMAGE_BYTES)
      throw new HttpError(413, 'Image too large. Max size is 10 MiB.');
    const lat = form.get('lat');
    const lng = form.get('lng');
    if (typeof lat !== 'string' || typeof lng !== 'string' || !lat.trim() || !lng.trim())
      throw new HttpError(422, 'Latitude and longitude are required.');
    const data = coordinatesSchema.safeParse({
      lat: Number(lat),
      lng: Number(lng),
      device_id: form.get('device_id') || 'manual',
    });
    if (!data.success) throw new HttpError(400, data.error.issues.map((i) => i.message).join(' '));
    const outbound = new FormData();
    outbound.set('image', image);
    outbound.set('lat', String(data.data.lat));
    outbound.set('lng', String(data.data.lng));
    outbound.set('device_id', data.data.device_id || 'manual');
    const response = await backendRequest(
      '/api/v1/detect',
      { method: 'POST', body: outbound, signal: request.signal },
      true,
    );
    const result = schemas.detectionResponseSchema.safeParse(await response.json());
    if (!result.success)
      throw new HttpError(502, 'The backend returned an unexpected detection response.');
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const path = (await context.params).path;
    if (path.length !== 2 || path[0] !== 'detections' || !/^[a-zA-Z0-9_-]{1,128}$/.test(path[1]))
      throw new HttpError(404, 'Endpoint not found.');
    assertSameOrigin(request);
    if (!(await isAdmin())) throw new HttpError(401, 'Sign in as RHA to delete detections.');
    const response = await backendRequest(
      '/api/v1/detections/' + encodeURIComponent(path[1]),
      { method: 'DELETE', signal: request.signal },
      true,
    );
    const result = schemas.deleteSchema.safeParse(await response.json());
    if (!result.success)
      throw new HttpError(502, 'The backend returned an unexpected deletion response.');
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
