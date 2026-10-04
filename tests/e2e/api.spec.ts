import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const origin = { Origin: 'http://localhost:3000' };
const image = fs.readFileSync('tests/fixtures/road.png');
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:8001/__scenario', { data: { scenario: 'normal' } });
});
test('serves every App Router page', async ({ request }) => {
  for (const route of ['/', '/dashboard', '/detect', '/detections', '/devices', '/report']) {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('Roadwatch');
  }
});
test('proxies validated public map, health, statistics, and report contracts', async ({
  request,
}) => {
  expect(await (await request.get('/api/backend/health')).json()).toMatchObject({
    pothole_model_ready: true,
  });
  expect(await (await request.get('/api/backend/stats')).json()).toMatchObject({
    total_detections: 2,
    mock_mode: false,
  });
  const map = await (await request.get('/api/backend/heatmap?min_confidence=0.8&limit=100')).json();
  expect(map).toHaveLength(1);
  const report = await (await request.get('/api/backend/report')).json();
  expect(report.total_detections).toBe(2);
  expect(report.regions[0].severity_breakdown.high).toBe(1);
});
test('forwards multipart uploads and the server-only API key', async ({ request }) => {
  const response = await request.post('/api/backend/detect', {
    headers: origin,
    multipart: {
      image: { name: 'road.png', mimeType: 'image/png', buffer: image },
      lat: '5.6',
      lng: '-0.18',
      device_id: 'web-test',
    },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.pothole_detected).toBe(true);
  expect(result.detections[0].bbox).toEqual({ x1: 180, y1: 180, x2: 340, y2: 280 });
  const upload = await (await request.get('http://127.0.0.1:8001/__upload')).json();
  expect(upload.fields).toEqual(['device_id', 'image', 'lat', 'lng']);
  expect(upload.imageBytes).toBe(image.length);
  expect(upload.lat).toBe(5.6);
});
test('preserves negative inference and model error responses', async ({ request }) => {
  const multipart = {
    image: { name: 'road.png', mimeType: 'image/png', buffer: image },
    lat: '5.6',
    lng: '-.18',
    device_id: 'no-potholes',
  };
  expect(
    await (await request.post('/api/backend/detect', { headers: origin, multipart })).json(),
  ).toMatchObject({ id: null, pothole_detected: false, detections: [] });
  await request.post('http://127.0.0.1:8001/__scenario', {
    data: { scenario: 'model-unavailable' },
  });
  const failed = await request.post('/api/backend/detect', { headers: origin, multipart });
  expect(failed.status()).toBe(503);
  expect((await failed.json()).detail).toContain('model is not available');
});
test('rejects invalid files, coordinates, excessive uploads, and query parameters', async ({
  request,
}) => {
  const valid = {
    image: { name: 'road.png', mimeType: 'image/png', buffer: image },
    lat: '5.6',
    lng: '0',
  };
  expect(
    (
      await request.post('/api/backend/detect', {
        headers: origin,
        multipart: { ...valid, lat: '1' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/backend/detect', {
        headers: origin,
        multipart: { ...valid, lat: '' },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.post('/api/backend/detect', {
        headers: origin,
        multipart: { ...valid, image: { name: 'clip.mp4', mimeType: 'video/mp4', buffer: image } },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/backend/detect', {
        headers: origin,
        multipart: {
          ...valid,
          image: {
            name: 'large.png',
            mimeType: 'image/png',
            buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
          },
        },
      })
    ).status(),
  ).toBe(413);
  expect((await request.get('/api/backend/heatmap?limit=2001')).status()).toBe(400);
  expect((await request.get('/api/backend/report?min_confidence=2')).status()).toBe(400);
  expect((await request.get('/api/backend/not-a-real-endpoint')).status()).toBe(404);
});
test('rejects unauthorized and cross-origin administrative requests', async ({ request }) => {
  expect((await request.get('/api/backend/detections/export?format=geojson')).status()).toBe(401);
  expect(
    (
      await request.delete('/api/backend/detections/11111111-1111-4111-8111-111111111111', {
        headers: origin,
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/auth', {
        headers: { Origin: 'https://attacker.example' },
        data: { password: 'fixture-admin-password' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post('/api/auth', { headers: origin, data: { password: 'wrong' } })).status(),
  ).toBe(401);
});
test('issues signed HttpOnly sessions, exports data, deletes a record, and revokes access', async ({
  request,
}) => {
  const login = await request.post('/api/auth', {
    headers: origin,
    data: { password: 'fixture-admin-password' },
  });
  expect(login.status()).toBe(200);
  expect(login.headers()['set-cookie']).toContain('HttpOnly');
  expect(login.headers()['set-cookie']).toContain('SameSite=strict');
  expect(await (await request.get('/api/auth')).json()).toMatchObject({ admin: true });
  const exported = await request.get('/api/backend/detections/export?format=geojson');
  expect(exported.status()).toBe(200);
  expect((await exported.json()).features).toHaveLength(2);
  const csv = await request.get('/api/backend/detections/export?format=csv');
  expect(csv.headers()['content-disposition']).toContain('detections.csv');
  expect(await csv.text()).toContain('device_id,lat,lng');
  const deleted = await request.delete(
    '/api/backend/detections/11111111-1111-4111-8111-111111111111',
    { headers: origin },
  );
  expect(await deleted.json()).toEqual({ deleted: '11111111-1111-4111-8111-111111111111' });
  expect(
    (await (await request.get('/api/backend/detections/export?format=geojson')).json()).features,
  ).toHaveLength(1);
  expect(
    (await request.delete('/api/backend/detections/missing-id', { headers: origin })).status(),
  ).toBe(404);
  await request.delete('/api/auth', { headers: origin });
  expect((await request.get('/api/backend/detections/export?format=csv')).status()).toBe(401);
});
test('reports mock mode and propagates backend failures', async ({ request }) => {
  await request.post('http://127.0.0.1:8001/__scenario', { data: { scenario: 'mock' } });
  expect((await (await request.get('/api/backend/stats')).json()).mock_mode).toBe(true);
  await request.post('http://127.0.0.1:8001/__scenario', { data: { scenario: 'offline' } });
  expect((await request.get('/api/backend/heatmap')).status()).toBe(503);
});
