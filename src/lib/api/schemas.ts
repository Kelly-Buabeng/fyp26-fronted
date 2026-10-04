import { z } from 'zod';

const confidence = z.number().min(0).max(1);
export const boundingBoxSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export const detectionItemSchema = z.object({
  label: z.string(),
  confidence,
  bbox: boundingBoxSchema,
});
export const detectionResponseSchema = z.object({
  id: z.string().nullable(),
  pothole_detected: z.boolean(),
  detections: z.array(detectionItemSchema),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  device_id: z.string(),
  timestamp: z.string(),
});
export const heatmapSchema = z.array(
  z.object({ lat: z.number(), lng: z.number(), intensity: confidence }),
);
export const statsSchema = z.object({
  total_detections: z.number().int().nonnegative(),
  avg_confidence: confidence,
  devices_active: z.number().int().nonnegative(),
  mock_mode: z.boolean(),
});
export const healthSchema = z.object({
  status: z.string(),
  model_loaded: z.boolean(),
  pothole_model_ready: z.boolean(),
});
export const serviceSchema = healthSchema.extend({ project: z.string(), docs: z.string() });
export const regionSchema = z.object({
  region: z.string(),
  total: z.number(),
  avg_confidence: confidence,
  severity_breakdown: z.object({ high: z.number(), medium: z.number(), low: z.number() }),
});
export const reportSchema = z.object({
  generated_at: z.string(),
  total_detections: z.number(),
  regions: z.array(regionSchema),
});
export const geojsonSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        id: z.string(),
        device_id: z.string(),
        confidence,
        severity: z.enum(['high', 'medium', 'low']),
        region: z.string(),
        created_at: z.string(),
        labels: z.array(z.string()),
      }),
    }),
  ),
});
export const deleteSchema = z.object({ deleted: z.string() });
