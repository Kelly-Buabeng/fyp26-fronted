import { describe, expect, it } from 'vitest';
import { detectionResponseSchema, heatmapSchema } from '@/lib/api/schemas';
import { coordinatesSchema } from '@/lib/validation/detection';
import { parseApiError } from '@/lib/api/errors';
import { nearestRegion } from '@/lib/geo';
describe('backend contracts', () => {
  it('accepts Ghana boundary coordinates and rejects invalid locations', () => {
    expect(coordinatesSchema.safeParse({ lat: 4.5, lng: -3.5 }).success).toBe(true);
    expect(coordinatesSchema.safeParse({ lat: 11.5, lng: 1.5 }).success).toBe(true);
    for (const point of [
      { lat: 4.49, lng: 0 },
      { lat: 12, lng: 0 },
      { lat: 5, lng: -3.51 },
      { lat: 5, lng: 2 },
      { lat: NaN, lng: 0 },
    ])
      expect(coordinatesSchema.safeParse(point).success).toBe(false);
  });
  it('handles an unpersisted negative result with no synthetic record ID', () => {
    expect(
      detectionResponseSchema.parse({
        id: null,
        pothole_detected: false,
        detections: [],
        coordinates: { lat: 5.6, lng: -0.18 },
        device_id: 'manual',
        timestamp: '2026-10-04T21:00:00Z',
      }).id,
    ).toBeNull();
  });
  it('rejects confidence values outside the API range', () => {
    expect(heatmapSchema.safeParse([{ lat: 5, lng: 0, intensity: 1.1 }]).success).toBe(false);
  });
  it('extracts FastAPI validation fields', () => {
    const error = parseApiError(
      { detail: [{ loc: ['body', 'lat'], msg: 'Invalid latitude' }] },
      422,
    );
    expect(error.fieldErrors.lat).toBe('Invalid latitude');
    expect(error.status).toBe(422);
  });
  it('assigns all sixteen regional-capital coordinates consistently', () => {
    expect(nearestRegion({ lat: 6.2044, lng: -2.4806 })).toBe('Western North');
    expect(nearestRegion({ lat: 7.7514, lng: 0.3489 })).toBe('Oti');
    expect(nearestRegion({ lat: 9.0833, lng: -1.8167 })).toBe('Savannah');
  });
});
