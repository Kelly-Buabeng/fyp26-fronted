// Contract fixture for tests only. No model inference or production database is used.
import { createServer } from 'node:http';
let scenario = 'normal';
const initial = () => [
  {
    id: '11111111-1111-4111-8111-111111111111',
    device_id: 'esp32-accra',
    lat: 5.6037,
    lng: -0.187,
    confidence: 0.91,
    severity: 'high',
    region: 'Greater Accra',
    created_at: new Date().toISOString(),
    labels: ['pothole'],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    device_id: 'esp32-kumasi',
    lat: 6.6885,
    lng: -1.6244,
    confidence: 0.62,
    severity: 'medium',
    region: 'Ashanti',
    created_at: new Date().toISOString(),
    labels: ['pothole'],
  },
];
let rows = initial();
let lastUpload = null;
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data));
}
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:8001');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (url.pathname === '/__scenario') {
      scenario = JSON.parse(body.toString()).scenario || 'normal';
      rows = initial();
      lastUpload = null;
      return json(res, 200, { scenario });
    }
    if (url.pathname === '/__upload') return json(res, 200, lastUpload);
    if (scenario === 'offline') return json(res, 503, { detail: 'Fixture backend unavailable.' });
    const protectedPath =
      url.pathname === '/api/v1/detect' ||
      url.pathname === '/api/v1/detections/export' ||
      req.method === 'DELETE';
    if (protectedPath && req.headers['x-api-key'] !== 'fixture-backend-key')
      return json(res, 401, { detail: 'Missing or invalid X-API-Key header.' });
    if (url.pathname === '/health')
      return json(res, 200, { status: 'ok', model_loaded: true, pothole_model_ready: true });
    if (url.pathname === '/')
      return json(res, 200, {
        project: 'FYP-26 Pothole Detection',
        status: 'online',
        model_loaded: true,
        pothole_model_ready: true,
        docs: '/docs',
      });
    if (url.pathname === '/api/v1/stats')
      return json(res, 200, {
        total_detections: rows.length,
        avg_confidence: rows.reduce((n, r) => n + r.confidence, 0) / (rows.length || 1),
        devices_active: new Set(rows.map((r) => r.device_id)).size,
        mock_mode: scenario === 'mock',
      });
    const filtered = rows
      .filter((r) => r.confidence >= Number(url.searchParams.get('min_confidence') || 0))
      .slice(0, Number(url.searchParams.get('limit') || 5000));
    if (url.pathname === '/api/v1/heatmap')
      return json(
        res,
        200,
        filtered.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, intensity: r.confidence, image_url: r.image_url })),
      );
    if (url.pathname === '/api/v1/report') {
      const groups = new Map();
      for (const row of filtered) {
        const group = groups.get(row.region) || {
          region: row.region,
          total: 0,
          avg_confidence: 0,
          severity_breakdown: { high: 0, medium: 0, low: 0 },
        };
        group.total++;
        group.avg_confidence += row.confidence;
        group.severity_breakdown[row.severity]++;
        groups.set(row.region, group);
      }
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        total_detections: filtered.length,
        regions: [...groups.values()].map((g) => ({
          ...g,
          avg_confidence: g.avg_confidence / g.total,
        })),
      });
    }
    if (url.pathname === '/api/v1/detections/export') {
      const format = url.searchParams.get('format');
      if (format === 'csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=detections.csv',
        });
        return res.end(
          'id,device_id,lat,lng,confidence,severity,region,num_objects,created_at\n' +
            filtered
              .map((r) =>
                [
                  r.id,
                  r.device_id,
                  r.lat,
                  r.lng,
                  r.confidence,
                  r.severity,
                  r.region,
                  1,
                  r.created_at,
                ].join(','),
              )
              .join('\n'),
        );
      }
      return json(res, 200, {
        type: 'FeatureCollection',
        features: filtered.map(({ lat, lng, ...properties }) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties,
        })),
      });
    }
    if (url.pathname === '/api/v1/detect' && req.method === 'POST') {
      if (scenario === 'model-unavailable')
        return json(res, 503, { detail: 'Pothole detection model is not available.' });
      const form = await new Request(url, {
        method: 'POST',
        headers: { 'content-type': req.headers['content-type'] },
        body,
      }).formData();
      const image = form.get('image');
      const device = form.get('device_id');
      lastUpload = {
        fields: [...form.keys()].sort(),
        imageType: image.type,
        imageName: image.name,
        imageBytes: image.size,
        lat: Number(form.get('lat')),
        lng: Number(form.get('lng')),
        device_id: device,
      };
      const positive = device !== 'no-potholes';
      const id = positive ? '33333333-3333-4333-8333-333333333333' : null;
      if (positive && scenario !== 'mock' && !rows.some((r) => r.id === id))
        rows.push({
          id,
          device_id: device,
          lat: lastUpload.lat,
          lng: lastUpload.lng,
          confidence: 0.92,
          severity: 'high',
          region: 'Greater Accra',
          created_at: new Date().toISOString(),
          labels: ['pothole'],
        });
      return json(res, 200, {
        id,
        pothole_detected: positive,
        detections: positive
          ? [{ label: 'pothole', confidence: 0.92, bbox: { x1: 180, y1: 180, x2: 340, y2: 280 } }]
          : [],
        coordinates: { lat: lastUpload.lat, lng: lastUpload.lng },
        device_id: device,
        timestamp: new Date().toISOString(),
      });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/v1/detections/')) {
      const id = url.pathname.split('/').at(-1);
      if (!rows.some((r) => r.id === id)) return json(res, 404, { detail: 'Detection not found.' });
      if (scenario !== 'mock') rows = rows.filter((r) => r.id !== id);
      return json(res, 200, { deleted: id });
    }
    json(res, 404, { detail: 'Not found.' });
  } catch (error) {
    json(res, 500, { detail: String(error) });
  }
}).listen(8001, '127.0.0.1', () => console.log('Contract fixture listening on 8001'));
