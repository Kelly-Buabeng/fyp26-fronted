# Verified backend API contracts

Source: [FYP-26-POTHOLE-DETECTION](https://github.com/Kelly-Buabeng/FYP-26-POTHOLE-DETECTION)
at commit `8e5fccb74cbd3c61cf91be4fb6081441d0426841`.

The source files inspected were `app/main.py`, `app/core/security.py`,
`app/core/config.py`, `app/schemas/detection.py`, the three endpoint modules,
`app/services/detector.py`, `app/services/detection_repo.py`, and
`app/services/geo.py`. Implementations take precedence over older README and
template claims.

| Function                            | Method and backend path          | Parameters                                                            | Response / access                                                    |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `getServiceInfo()`                  | `GET /`                          | None                                                                  | `{project,status,model_loaded,pothole_model_ready,docs}`; public     |
| `getHealth()`                       | `GET /health`                    | None                                                                  | `{status,model_loaded,pothole_model_ready}`; public                  |
| `getHeatmap(options)`               | `GET /api/v1/heatmap`            | `limit=500` (max 2000), `min_confidence=0.4` (0–1)                    | `{lat,lng,intensity}[]`; public                                      |
| `getStats()`                        | `GET /api/v1/stats`              | None                                                                  | `{total_detections,avg_confidence,devices_active,mock_mode}`; public |
| `getRegionalReport(options)`        | `GET /api/v1/report`             | `limit=5000` (max 20000), `min_confidence=0.4`                        | `ReportResponse`; public                                             |
| `detectImage(input, options)`       | `POST /api/v1/detect`            | Multipart `image`, `lat`, `lng`, optional `device_id=manual`          | `DetectionResponse`; backend API key                                 |
| `exportDetections(format, options)` | `GET /api/v1/detections/export`  | `format=csv\|geojson`, `limit=5000` (max 20000), `min_confidence=0.0` | Download blob; backend API key                                       |
| `deleteDetection(id)`               | `DELETE /api/v1/detections/{id}` | Record ID                                                             | `{deleted: id}` or 404; backend API key                              |
| `getSavedDetections(options)`       | Adapter over GeoJSON export      | Same export filters                                                   | Validated table records; frontend RHA session                        |

Browser requests use `/api/backend/*`; an explicit server allowlist maps these
to backend paths. Arbitrary backend proxying is not available. Detection is
public through the frontend for citizen submissions, with origin checks and
upload rate limits. Frontend service information, statistics, regional reports, exports, and
deletion require the signed authority session. Exports and deletion also use
the server-forwarded backend API key. The access column above describes the
upstream FastAPI contract, which has no user identity system.

`getStorageMode()` calls public `GET /api/backend/mode`, validates the backend
statistics internally, and returns only `{mock_mode: boolean}`. Full statistics
are never returned by this public route.

## Frontend authentication

| Route              | Contract                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth`   | JSON `{email,password}`; matching server configuration creates an eight-hour signed HttpOnly cookie. Same-origin request required. Wrong credentials return a generic 401. |
| `GET /api/auth`    | `{admin,enabled}`; session status without secret data                                                                                                                      |
| `DELETE /api/auth` | Same-origin sign-out; expires the session cookie                                                                                                                           |

Authority page requests redirect to `/login?next=<local-authority-path>` when
signed out. The login page restricts return destinations to authority pages,
preventing redirects to external sites. Authorization is also checked inside
each protected server page and API handler. Browser role controls cannot grant
permissions. Login is limited to eight attempts per fifteen minutes per trusted forwarded IP,
or per process when forwarded headers are not trusted.

## Detection request

```text
Content-Type: multipart/form-data; boundary=<browser-generated>
X-API-Key: <server-only>

image: JPEG/PNG file, at most 10 * 1024 * 1024 bytes
lat: number, 4.5 <= latitude <= 11.5
lng: number, -3.5 <= longitude <= 1.5
device_id: optional string, defaults to manual
```

The backend checks `image/*` MIME types and decodes with Pillow. The frontend
intentionally accepts only JPEG and PNG, matching the documented contract,
and restricts decoded images to 40 megapixels. JPEG orientation is baked into
pixels before upload because backend decoding does not perform EXIF transpose.

```ts
interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface DetectionItem {
  label: string;
  confidence: number;
  bbox: BoundingBox; // Original submitted image pixels, not normalized fractions.
}
interface DetectionResponse {
  id: string | null;
  pothole_detected: boolean;
  detections: DetectionItem[];
  coordinates: { lat: number; lng: number };
  device_id: string;
  timestamp: string;
}
```

Inference completes within the POST request and returns HTTP 200. There is no
job ID, polling endpoint, inference percentage, or stream. The browser displays
measured upload progress followed by an indeterminate analysis state. Cancelling
the request does not guarantee that backend inference or saving has stopped.

The backend returns a positive result if a pothole confidence is at least 0.4.
Model predictions below that threshold can still appear in `detections`, but
they do not trigger saving. `id: null` can therefore be a valid result. The
backend model prediction threshold defaults to 0.35.

| Error | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| 400   | Coordinates outside Ghana, invalid file, or malformed frontend filters |
| 401   | Missing/invalid backend key, or missing frontend RHA session           |
| 403   | Mutation request origin not allowed                                    |
| 404   | Record/endpoint not found                                              |
| 413   | Image or multipart body exceeds configured limits                      |
| 422   | Backend image decode or form validation failure                        |
| 429   | Frontend request rate limit reached                                    |
| 502   | Backend unreachable or unexpected response contract                    |
| 503   | Pothole model unavailable or frontend configuration incomplete         |
| 504   | Backend timeout or request cancellation                                |

## Reports and exports

```ts
interface ReportResponse {
  generated_at: string;
  total_detections: number;
  regions: {
    region: string;
    total: number;
    avg_confidence: number;
    severity_breakdown: { high: number; medium: number; low: number };
  }[];
}
```

Severity is confidence-based: high >= 0.75, medium >= 0.5, otherwise low.
Regional assignment uses haversine distance to all sixteen regional capitals,
rather than precise administrative boundary polygons.

GeoJSON point coordinates use `[longitude, latitude]`. Properties include
`id`, `device_id`, `confidence`, `severity`, `region`, `created_at`, and `labels`.
They do not include full detections, bounding boxes, image URLs, road names, or
repair state. The table adapter only displays fields actually present.

CSV columns are `id,device_id,lat,lng,confidence,severity,region,num_objects,created_at`.
Backend exports are streamed unchanged; the backend neutralizes spreadsheet
formula prefixes in device IDs.

## Mock mode

Without configured Supabase credentials, statistics return zero totals with
`mock_mode: true`, while map and regional endpoints return independent sample
datasets. Uploads may return a generated record ID without saving anything.
Deletions return success without changing the generated sample records.
The frontend labels this mode and does not claim durable persistence.

The mock heatmap implementation ignores requested confidence/limit filters;
the frontend additionally applies them locally. Generated mock-export IDs can
change between requests. Production data requires valid Supabase credentials.
