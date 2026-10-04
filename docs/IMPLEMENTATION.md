# Implementation and design mapping

The original `pothole-console-v2.html` was used for the design. Its CSS tokens,
Instrument Sans / IBM Plex Mono typography, muted background, map overlays,
pill controls, panels, severity colors, table spacing, density modes, responsive
breakpoints, and drawer transitions are retained in `Roadwatch.module.css`.
Layout primitives and shared controls are React components; no static HTML is
injected and none of the template's seeded sample records are embedded in the
production frontend.

| Original screen         | React implementation                                              |
| ----------------------- | ----------------------------------------------------------------- |
| Live map                | `features/map/live-map.tsx`, dynamically loaded `leaflet-map.tsx` |
| Dashboard               | `features/dashboard/dashboard.tsx`                                |
| Regional report         | `features/reports/regional-report.tsx`                            |
| Detections              | `features/detections/detections-table.tsx`                        |
| Run detection           | `features/detection/upload-form.tsx`, `image-preview.tsx`         |
| Devices & health        | `features/devices/devices-health.tsx`                             |
| Detail drawer           | Accessible modal `<dialog>` with original drawer styling          |
| Role and density switch | Shared console provider and App Router navigation                 |

## Behaviors adjusted to match the API

- The original upload form fabricated a sample detection on every click. It now
  submits the actual file and coordinates, awaits backend inference, and shows
  the returned result, including valid negative results.
- Bounding boxes are rendered in the actual image's natural coordinate space.
  The original template's fixed 640x360 placeholder frame is removed.
- The public map endpoint exposes neither record IDs nor capture timestamps.
  Its feed displays locations and confidence, without claiming newest-first
  timestamps or named roads. Device and time filtering belong to saved-record
  metadata, rather than anonymous map points.
- Dashboard totals are backend statistics. The original invented daily chart
  is replaced with a map-confidence histogram, which public data can support.
- `devices_active` counts distinct stored device IDs. The UI labels this as
  devices recorded rather than online devices.
- The original devices page fabricated battery, firmware, and heartbeat data.
  The port shows model readiness and, after GHA login, last detection times
  derived from exported metadata.
- Record lists use a validated GeoJSON export adapter because there is no
  list/detail endpoint. Pagination is local over the requested export cohort.
  Search filters the table; the CSV/GeoJSON buttons export the backend cohort
  selected by confidence and fetch limit, rather than the table's text search.
- False-positive deletion reaches the actual DELETE endpoint. Its confirmation
  dialog includes the record ID and region. Mock-mode acknowledgements are
  identified as nonpersistent.
- Repair confirmation, queue status, contact information, and feedback fields
  are omitted because no backend endpoint persists them.
- The view switch grants no permissions. GHA session authorization is checked
  on the server for every export and deletion; changing the UI cannot bypass it.

## Access and request handling

The backend has a shared API key, not a user identity system. This frontend adds
an operator-password gate with an eight-hour HMAC-signed, HttpOnly, SameSite
Strict cookie. Production cookies are Secure. Changing either the password or
signing secret revokes existing sessions. Password comparison is constant-time.
Mutation requests require an exact matching Origin. Uploads and login attempts
are rate-limited per process, and only approved backend paths are reachable.

Public submissions intentionally use the server's key to call the protected
backend image endpoint. The backend key and Supabase service credentials are
never exposed to browser bundles. Configure ingress limits for public uploads
and replace the shared-password gate with organizational identity if individual
operator accounts are needed.

## Remaining backend capabilities

The following require changes to the backend rather than invented frontend API
calls:

1. Video uploads or frame-batch inference.
2. Asynchronous job creation, status polling, cancellation, or live inference streams.
3. Paginated record listing and full record details with stored bounding boxes.
4. Original image storage and signed media retrieval.
5. Repair queue, confirmation, completion state, or citizen feedback.
6. User accounts, individual GHA roles, and audit events.
7. Device heartbeat, firmware, battery, and fleet-management endpoints.

The implementation is ready to connect to the existing image API. Production
end-to-end YOLO/Supabase behavior still requires the operator's running backend,
trained weights, database credentials, and deployment configuration.
