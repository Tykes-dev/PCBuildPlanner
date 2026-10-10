# PC Build Compatibility & Budget Planning System

CTADWEBL final project — National University Clark, A.Y. 2026–2027.

Group members: Nunag (core planning); add the other members and their actual contributions before submission.

The app helps customers plan seven tower components within a budget. It checks supported hardware relationships, estimates power, and recommends compatible catalog parts. It is not a checkout or payment system.

## Local setup

Open this folder in VS Code. Use Node.js 22.12+ (Node 24 LTS recommended).

```powershell
npm install
Copy-Item backend/.env.example backend/.env
# Edit backend/.env with your private MongoDB Atlas connection string.
npm run seed
npm run dev
```

Open http://localhost:5173. The API uses http://localhost:3001/api.
The backend must be connected to Atlas; there is no fake persistence fallback.
See [step-by-step external setup](docs/SETUP.md). The user creates GitHub and Atlas themselves.

Environment: backend PORT, MONGO_URI, CLIENT_ORIGIN. Optional frontend VITE_API_URL defaults to http://localhost:3001/api. Never put database credentials in a VITE_ variable.

## Implemented

- Ten frontend pages: public landing, recommendation, planner, public catalog, shared account page, admin users, admin add-component page, saved builds, build details, and admin reports/review.
- Eight database models and 30 method/path API endpoints, including catalog/planning, authentication, admin access, saved builds, requests, and reports.
- Compatibility and memory quantity checks, power headroom, balance warnings, profile minimum notes.
- Budget allocations with exact rounding and editable locks.
- Feasibility-based recommendations and priority upgrades within the total budget.
- Session draft and printable build sheet; persistent customer-owned builds with rename, duplicate, details, and reopening at current catalog prices.
- Customer build requests with immutable submission snapshots, administrator status updates/remarks, and an all-time activity dashboard.
- Single axios instance, abortable loading/error flows, Zod recommendation form.
- Product photos matched to all 34 sample catalog models, with photo-source links and variant captions where no exact SKU was specified. Remote image failures show an honest unavailable-photo state.
- Compatibility-aware planner cards: incompatible/out-of-stock choices are greyed out and disabled before selection, with reasons. Compatible choices within the category target sort first; over-target parts stay selectable.
- Refined light/dark interface with a PC tower illustration, restrained amber accents, catalog category tabs/counts and sample-score bars, and a planner budget-use meter. No gradients or additional dependencies.

## API reference — current core

All routes start with /api. Item input: `{ "componentId": "MONGODB_OBJECT_ID", "quantity": 1 }`.

| Method | Path | Purpose | Sample request | Response |
| --- | --- | --- | --- | --- |
| GET | /health | Connection readiness | — | `{ "database": "connected" }` or 503 |
| GET | /components | Active catalog; optional category/q filters | `?category=cpu&q=Ryzen` | Array of component documents |
| GET | /components/:id | One active part | — | Component or 400/404 |
| GET | /profiles | Active use cases | — | Array of profiles |
| GET | /profiles/:slug | One use case | — | Profile or 404 |
| POST | /allocations | Exact peso split and locks | `{ "budget": 50000, "profileSlug": "gaming", "locks": { "gpu": 20000 } }` | Allocation array |
| POST | /recommendations | Compatible build within budget | `{ "budget": 50000, "profileSlug": "gaming" }` | `{ "feasible": true, "items": [], "allocations": [], "validation": {}, "remaining": 0, "message": "..." }` (arrays contain real results) |
| POST | /validations | Evaluate draft parts | `{ "items": [], "profileSlug": "gaming" }` | `{ "valid": false, "missingCategories": [], "issues": [], "power": {}, "total": 0 }` (missing array lists unselected categories) |
| POST | /power-calculations | Draw and PSU requirement | `{ "items": [] }` | `{ "totalDraw": 0, "marginPercent": 30, "requiredWattage": 0, "supplyRating": null, "sufficient": false }` |
| POST | /balance-assessments | Pairwise sample score warnings | `{ "items": [] }` | `{ "issues": [] }` |
| POST | /component-options | Check catalog candidates before selection using the final validation rules | `{ "items": [] }` | Array of `{ "componentId": "...", "compatible": true, "available": true, "reasons": [] }` |

Errors use `{ "message": "..." }`, optionally `fields`. Invalid input: 400; missing record: 404; duplicates: 409; database unavailable: 503; unexpected server failure: 500.

## Validation

Verified October 7, 2026: `npm test` passed all 16 backend service/API checks after expanding the catalog to 34 components. All 34 entries passed Mongoose schema validation, and all 14 new photo URLs returned image responses. MongoDB category counts and the running API confirmed 34 records with image metadata. The earlier `npm run build` passed strict TypeScript checking and the Vite production build. Earlier browser checks confirmed AM5 boards are disabled after choosing an AM4 CPU, and DDR5 memory is disabled with a DDR4 board. A 375px-wide preview had no horizontal overflow. These checks do not establish complete end-to-end verification of future team modules.

## Remaining work and limitations

Component editing/archiving, admin allocation/check configuration, showcase, and final integration/submission QA remain. The implemented 30 endpoints, 10 pages, and eight related models meet the course's numerical targets; this does not replace the remaining rubric and submission review.

Catalog prices and performance scores are educational samples adapted from the supplied prototype. Score gaps are rough indicators, not benchmark-based bottleneck predictions. This implementation and its design are independently adapted, not copied verbatim.

Socket equality alone does not verify BIOS support. Storage connectors, GPU/case clearance, PSU connectors, coolers, fans, peripherals, monitors, and operating systems are outside these checks. A discrete GPU is always required by this first seven-category planner; integrated-graphics-only builds are not supported. Memory capacity is treated as capacity per selectable unit; catalog entries must use a consistent stick/kit convention before production use.

Recommendation is a heuristic; category locks are allocation targets. It does not claim a globally optimal build or enforce category caps during leftover upgrades. Candidate checks cover the supported rules only. To switch platforms, remove the conflicting selected parts first. Picker options refresh when selections/quantities change; a reload also refreshes changed shop settings. Model-specific image URLs can be supplied through Component.imageUrl; bundled sample-photo metadata is used when an existing sample record has no image URL, without modifying its stored price or specs. Photos are hosted by external manufacturer/retailer sites and require internet access.

Preview screenshots: [catalog photos](docs/catalog-photos-preview.jpg), [compatibility picker](docs/planner-compatible-options-preview.jpg), and [mobile planner](docs/planner-mobile-preview.jpg). Add the remaining final submission screens as team modules are completed.

Read [CONTEXT.md](CONTEXT.md) and [CHANGELOG.md](CHANGELOG.md) for handovers.

## Customer accounts and public access

Guests see the public landing page at / and can open /components and the combined /auth page. Log in and Register are modes of the same account page; old /login and /register links redirect there. Planner and recommendations require login. Registration creates a customer account; then log in to access Overview, Find a build, Planner, and Saved builds. Admin accounts use the same login form and open the reports/review dashboard at /admin/reports.

| Method | Path | Access |
| --- | --- | --- |
| POST | /api/auth/register | Public; name, email, password (12–128 characters); always customer |
| POST | /api/auth/login | Public; email and password; sets a seven-day HttpOnly cookie |
| GET | /api/auth/me | Current customer or admin session |
| POST | /api/auth/logout | Revokes current session and clears cookie |
| GET | /api/admin/users | Admin only; lists the latest 500 accounts |
| PATCH | /api/admin/users/:id/role | Admin only; changes customer/admin role and revokes sessions |
| POST | /api/admin/components | Admin only; creates a validated catalog component |

Catalog reads and health checks remain public. All profile and planning routes require a customer cookie (401 if missing/expired, 403 for non-customer accounts). Passwords use salted scrypt hashes; only hashed session tokens are stored. No passwords or session tokens are returned in JSON. Registration/login share a per-process limit of 20 attempts per IP per 15 minutes.

Run the backend with a working MongoDB connection to register; no test or default customer is seeded. Backend startup initializes unique account/session indexes. Use matching development hostnames for frontend and API. Production needs HTTPS and same-site hosting for the frontend/API, or an /api reverse proxy; configure CLIENT_ORIGIN and VITE_API_URL accordingly. Multi-instance production deployments need a shared auth rate limiter and trusted proxy configuration.

October 9 verification: 18 backend tests passed, including mocked registration/login/logout, role protection, expiry, guest API restrictions, and origin checks. Frontend TypeScript and production build passed. Live Atlas registration and browser interaction were not verified in this change; the browser tool could not initialize its Windows sandbox helper.

Create the first administrator from PowerShell with the backend configured in backend/env. Add temporary ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD values to that ignored local file, then run npm run create-admin -w backend. The password must have 12–128 characters. Remove those temporary entries after the script succeeds. The script refuses to promote an existing account. Afterward, sign in at /auth. Admins can change account roles from /admin/users; promoting an account requires the person to log in again, and the last admin cannot be demoted.

Admins can use Add component (/admin/components) to enter general details, category-specific compatibility specs, stock/availability, and optional photo metadata. The API rejects unknown fields, invalid values, and duplicate brand/name combinations. Created records are active catalog parts and appear in the public library and customer planner when those pages load. Stock and availability are maintained independently; this app has no purchase inventory workflow.

Double-click run-app.bat to start the API and website, then press any key in the launcher to open Home in your browser. To open the planner directly, use http://127.0.0.1:5173/builder; guests are sent to /auth and returned to the planner after customer login.

Earlier October 9 checks: all 23 backend tests passed and TypeScript/Vite production build passed. Headless Edge checks verified account modes, registration feedback, planner login return, admin guards, category-specific creation fields, success/field errors and 375px layouts with mock API data. The live API was restarted and verified connected to Atlas with 34 components; guest component creation returned 401. No test catalog records or users were written to Atlas.

## Saved builds, requests, and reports

Customers can save a named draft from /builder, return to it at /builds, and open /builds/:id to rename, duplicate, reopen, or submit it for review. Saving accepts empty/incomplete/incompatible drafts and manual builds above budget. Reopening lets the customer update the original or save a new copy. Every build operation is scoped to the logged-in customer; foreign build IDs return 404.

Build details use component prices/specifications captured by the server when saved. Duplication copies those historical snapshots. Reopening loads current catalog prices/specifications, removes missing/archived/out-of-stock parts with notices, and keeps low-stock quantities editable with a warning. If the original profile is inactive, an active profile is selected and explained.

Submitting a request checks the current catalog again. All seven categories and supported compatibility checks must pass; components must be available, and quantities must fit tracked stock. Manual over-budget submissions are allowed, and both total and budget are displayed to the administrator. Each request stores its own immutable submission snapshot, so subsequent saved-build edits or renames do not rewrite submitted parts/prices.

Admins log in to /admin/reports to see all-time saved-build/request totals, status breakdown, active counts, common component selections, and the request review queue. Pending requests can be approved or rejected; approved requests can be completed. Admins can add remarks. Rejected/completed requests are closed, and stale status changes return 409. A database index permits only one pending/approved request for each customer/build. Requests do not reserve or deduct stock.

Customer/admin histories display the latest 200 requests; dashboard totals cover all records. The common-components report shows the top 10 parts across saved builds, including duplicated drafts. Selections count builds containing a part; units include memory/storage quantities. These are planning-activity counts.

### Saved-build and request API

All paths below start with /api. A build payload is `{ "name": "Gaming draft", "budget": 50000, "profileSlug": "gaming", "items": [{ "componentId": "MONGODB_OBJECT_ID", "quantity": 1 }] }`. The server resolves catalog components and calculates snapshots/totals.

| Method | Path | Access and behavior |
| --- | --- | --- |
| GET | /builds | Customer; own saved builds ordered by latest update |
| POST | /builds | Customer; saves a named draft using the build payload |
| GET | /builds/:id | Customer owner; historical parts, budget, total and timestamps |
| PUT | /builds/:id | Customer owner; replaces saved draft using the build payload |
| PATCH | /builds/:id | Customer owner; rename with `{ "name": "New name" }` |
| POST | /builds/:id/duplicate | Customer owner; preserves snapshots; optional `{ "name": "Copy name" }` or `{}` |
| POST | /builds/:id/reopen | Customer owner; `{}` returns current `plan` and explanatory `notices` |
| GET | /requests | Customer; latest 200 own submission snapshots/statuses |
| POST | /requests | Customer; `{ "buildId": "MONGODB_OBJECT_ID", "note": "Optional note" }` |
| GET | /admin/reports | Admin; all-time totals/status counts and top 10 saved component selections |
| GET | /admin/requests | Admin; latest 200 requests with customer identity and submission snapshots |
| PATCH | /admin/requests/:id/status | Admin; `{ "status": "approved", "remarks": "Optional remarks", "expectedStatus": "pending" }` |

Build/request payloads reject unsupported fields. Budgets are positive whole-peso numbers, names are 1–100 characters, and quantities are integers from 1–32 with one row per category. Only memory/storage allow quantity greater than one. Request notes/remarks support up to 1,000 characters.

Build references its User owner, AllocationProfile, and selected Components; BuildRequest references its User owner, Build, and optional reviewing User. Embedded item snapshots intentionally retain historical values alongside those references.

Latest October 9 verification: all 30 backend tests and the final TypeScript/Vite production build passed. Headless Edge checks used mock APIs to verify saving, renaming, duplication, current-price reopening, updating/Save as new, request snapshots/feedback, search and role guards, admin approve/reject/complete, refreshed counts, remarks/history, empty states, post-update refresh failures, and desktop/375px layouts. Live read-only checks confirmed Atlas connection, 34 catalog records, zero initial saved builds/requests, the active-request unique partial index, and guest 401 responses from protected new endpoints. No live test records were created; authenticated mutations were checked with isolated mocks.

Preview screenshots use simulated data: [saved build details](docs/saved-build-details-preview.jpg), [mobile details](docs/saved-build-mobile-preview.jpg), [admin dashboard](docs/admin-reports-preview.jpg), and [mobile dashboard](docs/admin-reports-mobile-preview.jpg).


