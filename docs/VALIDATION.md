# Validation results

The finished source was checked with Node.js 24.19.0 and the exact package
versions recorded in `package-lock.json`.

| Check                        | Result                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`          | Passed                                                                                                                                                                     |
| `npm run lint`               | Passed, no errors or warnings                                                                                                                                              |
| `npm run build`              | Passed: all six pages and the auth/backend route handlers compiled                                                                                                         |
| `npm test`                   | 15 tests passed: contracts, signed sessions, origin checks, production configuration, upload validation, positive/negative/error UI states, and natural-dimension overlays |
| `npm run test:integration`   | 8 tests passed through a running Next.js server and local HTTP backend fixture                                                                                             |
| Full Chromium browser suite  | Could not execute in this environment: Chromium exited before page creation, and the remote preview browser blocked localhost access                                       |
| Live YOLO/Supabase inference | Not performed; requires the configured running backend and trained weights                                                                                                 |

The build environment did not expose OS resident-memory metrics to Node.js.
A temporary, external compatibility shim substituted V8 heap metrics only
when Next.js build tracing requested unavailable RSS accounting. It did not
modify application source, compiler checks, API contracts, or runtime logic,
and it is not included in the project archive. Use the standard build command
on a normal Node.js host.

The HTTP integration tests cover:

- Serving all six App Router pages.
- Validated health, map, statistics, and report responses.
- Multipart image bytes and fields passing through the proxy with the
  server-only API key.
- Negative inference results and model-unavailable errors.
- Invalid coordinates/files, oversized uploads, invalid filters, and unknown
  endpoints.
- Missing sessions and cross-origin administrative requests.
- HttpOnly signed-session issuance, CSV/GeoJSON exports, deletion, missing-record
  responses, and sign-out revocation.
- Mock mode and upstream failures.

These use a contract fixture derived from the inspected backend source; they
do not establish deployed-model accuracy or real database persistence. The
included browser suite checks navigation, image selection, overlay dimensions,
GHA operations, model errors, and horizontal overflow at a mobile viewport.
Run it locally with `npx playwright install chromium` and `npm run test:e2e`.

Visual fidelity was implemented by porting the supplied v2 CSS into scoped
CSS Modules. Pixel-level rendering and responsive browser screenshots remain
unverified because of the browser execution limitation above.
