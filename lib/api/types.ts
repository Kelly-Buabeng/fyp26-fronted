import type { z } from 'zod';
import type * as schemas from './schemas';
export type BoundingBox = z.infer<typeof schemas.boundingBoxSchema>;
export type DetectionItem = z.infer<typeof schemas.detectionItemSchema>;
export type DetectionResponse = z.infer<typeof schemas.detectionResponseSchema>;
export type SubmitResponse = z.infer<typeof schemas.submitResponseSchema>;
export type DetectionRecord = {
  id: string;
  device_id: string;
  lat: number;
  lng: number;
  confidence: number;
  detections?: DetectionItem[];
  status?: string;
  image_url?: string;
  created_at: string;
};
export type PotholeStatus = 'pending' | 'confirmed' | 'declined' | 'fixed';
export type HeatmapPoint = z.infer<typeof schemas.heatmapSchema>[number];
export type StatsResponse = z.infer<typeof schemas.statsSchema>;
export type HealthResponse = z.infer<typeof schemas.healthSchema>;
export type RegionReport = z.infer<typeof schemas.regionSchema>;
export type ReportResponse = z.infer<typeof schemas.reportSchema>;
export type GeoJsonResponse = z.infer<typeof schemas.geojsonSchema>;
export type SavedDetection = GeoJsonResponse['features'][number]['properties'] & {
  lat: number;
  lng: number;
};
export type ExportFormat = 'csv' | 'geojson';
export type QueryOptions = { min_confidence?: number; limit?: number; status?: string };
export type DetectionInput = { image: File; lat: number; lng: number; device_id?: string };
export type UploadOptions = {
  signal?: AbortSignal;
  onProgress?: (percentage: number) => void;
  onUploaded?: () => void;
};
