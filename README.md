# Roadwatch Next.js frontend.

Next.js 16.3.8 App Router, React 19.3.0, TypeScript, CSS Modules, React Hook Form,
Zod, SWR, and Leaflet. This application ports `pothole-console-v2.html` from the
supplied Modern UI archive into reusable React components and connects its
screens to the FYP-26 FastAPI backend.

Backend source reviewed: `Kelly-Buabeng/FYP-26-POTHOLE-DETECTION`, `main`, commit
`8e5fccb74cbd3c61cf91be4fb6081441d0426841`. See `docs/API.md` for
the verified endpoint contracts and `docs/IMPLEMENTATION.md` for implementation
decisions and remaining backend requirements.

## Run locally

Use Node.js 20.9 or newer (Node.js 24 LTS recommended).

```bash
npm ci
cp .env.example .env.local
# Configure the server-only values described below.
npm run dev
```

Open http://localhost:3000. In `.env.local`, set `BACKEND_API_URL` to the FastAPI
origin and `BACKEND_API_KEY` to the backend's `API_KEY`. The backend prefix
`/api/v1` is added by the client; do not include it in the base URL.

Configure `ADMIN_EMAIL` (the example uses `authority@rha.com`),
`ADMIN_PASSWORD`, and `SESSION_SECRET` in `.env.local` or your hosting
platform's server environment. The requested account password and session
secret are intentionally excluded from this public repository; use the private
configuration supplied with the project archive or set your own values.
The password stays on the server and is never included in browser JavaScript.
Open `/login` or use **Authority login** in the header.

Visitors can use the live map and report a pothole without signing in. The
Dashboard, Regional report, Detections, and Devices pages require an authority
session. Direct URLs redirect to the themed login page and return to the
requested page after sign-in. Sign-out returns to the public map and clears
cached authority data. Authority navigation is derived from the signed session.

For a new installation, configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least
12 characters), and `SESSION_SECRET` (at least 32 characters). Quote passwords
containing `#` in dotenv files. Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No backend account registration or user-login endpoint exists.

Start the backend separately, from its repository:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Configure the backend's Supabase credentials, database schema, and trained
`MODEL_PATH` as described in its README. The health endpoint must report
`pothole_model_ready: true` before uploads can run inference.

## Screens

| Route         | Access    | Function                                                                       |
| ------------- | --------- | ------------------------------------------------------------------------------ |
| `/`           | Public    | Live map with location details and filters                                     |
| `/detect`     | Public    | Report a pothole: image, location, upload progress, results and bounding boxes |
| `/login`      | Public    | Themed authority email/password login                                          |
| `/dashboard`  | Authority | Stored totals, regional bands and confidence distribution                      |
| `/report`     | Authority | Regional aggregates, filters and exports                                       |
| `/detections` | Authority | Record search, pagination, details, export and confirmed deletion              |
| `/devices`    | Authority | Model health and recorded device activity                                      |

## Environment variables

All values are server-only. No API key is included in browser JavaScript.

| Variable             | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `BACKEND_API_URL`    | Backend origin; defaults to `http://127.0.0.1:8000`                                  |
| `BACKEND_API_KEY`    | Forwarded as `X-API-Key` on detection, export, and deletion                          |
| `ADMIN_EMAIL`        | Authority personnel email address; supplied account is `authority@rha.com`           |
| `ADMIN_PASSWORD`     | Shared authority account password; at least 12 characters                            |
| `SESSION_SECRET`     | HMAC signing secret; at least 32 characters                                          |
| `APP_ORIGIN`         | Exact frontend origin for mutation-origin checks                                     |
| `BACKEND_TIMEOUT_MS` | Upstream timeout; defaults to 120000, allowed range 1000–170000                      |
| `TRUST_PROXY`        | Defaults to `false`; enable only behind an ingress that overwrites `X-Forwarded-For` |

## Build and deploy

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm start
```

Deploy to a Node.js-compatible Next.js host; this application requires server
route handlers and cannot be served as a static export. Set all server-only
variables on the host, including an HTTPS `APP_ORIGIN`. Production API requests
fail closed if the backend key, authority email/password, session secret, or HTTPS origin
is missing. Keep `.env.local` out of source control.

The production backend should use `APP_ENV=production`, a real API key,
restricted `CORS_ORIGINS`, configured Supabase credentials, and trained pothole
weights. Frontend requests travel through Next.js, so the browser does not
need direct backend CORS access or Supabase credentials.

Configure the hosting platform and ingress to accept at least 11 MiB multipart
bodies and allow inference requests to run up to 180 seconds. Some serverless
providers impose smaller request-body limits; use a Node/container deployment
or introduce direct signed uploads in the backend when necessary. The proxy
bounds both declared and actual upload bytes before parsing multipart data.

The included login and upload limiter is per process. A multi-instance
deployment needs ingress or Redis-backed rate limits. Leave `TRUST_PROXY=false`
unless your ingress sanitizes forwarded IP headers. HTTPS is needed for secure
session cookies, geolocation, and production origin checks.

The shared-account RHA login is suitable for a small operator group. For
individual accounts, audit trails, and role-based access, replace it with your
organization's identity provider and enforce permissions in the backend too.

Map tiles come from OpenStreetMap and fonts from Google Fonts. Follow the map
provider's usage policy and use a commercial/self-hosted tile service for
traffic beyond the public tile service's capacity. Self-host the two font
families if your deployment requires offline operation.

## Tests

```bash
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

The HTTP integration and browser suites start Next.js and a local contract fixture on ports 3000 and 8001. They cover uploads through the Next.js proxy, sessions,
origin checks, exports, deletion, negative inference, model failures, and
responsive page widths. All fixture credentials and images are test-only and independent of the real authority account. Tests
do not call a deployed backend or run YOLO. For a custom Chromium installation,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

`npm test` also covers upload interactions and pixel-overlay scaling in a DOM
test environment. `npm run test:integration` does not require an installed
browser. See `docs/VALIDATION.md` for the checks completed during conversion
and the environment-specific browser verification limitation.

Before connecting a production model, smoke-test a real JPEG/PNG upload,
confirmed and negative detections, Supabase persistence, export, and deletion
against your running backend. No deployment or live inference has been
performed as part of this conversion.

## Project structure

```text
src/
  app/                         App Router pages and server route handlers
    login/                     Authority sign-in page
    api/auth/                  RHA session login, logout, and status
    api/backend/[...path]/     Strict allowlist proxy for verified endpoints
  components/
    layout/                    Console providers, header, footer
    ui/                        Panels, dialogs, notices, errors, loading states
    features/                  Auth, detection, map, dashboard, reports, records, devices
  proxy.ts                     Server redirect guard for authority pages
  lib/
    access.ts                  Safe login destinations and protected paths
    api/                       Typed fetch/upload clients, response schemas, errors
    server/                    Secrets, signed sessions, origin checks, rate limiter
    validation/                Upload and Ghana-coordinate validation
  styles/                      Original design tokens and scoped CSS Modules
tests/                         Contract, access-control, and browser tests
docs/                          API contracts, design mapping, and backend limitations
```
