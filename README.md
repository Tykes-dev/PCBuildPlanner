# PC Build Compatibility & Budget Planning System

CTADWEBL final project — National University Clark, A.Y. 2026–2027.

Group members: Nunag (core planning); add the other members and their actual contributions before submission.

The app helps customers plan seven tower components within a budget. It checks supported hardware relationships, estimates power, and recommends compatible catalog parts. It is not a checkout or payment system.

## Local setup

Open this folder in VS Code. Use Node.js 22.12+ (Node 24 LTS recommended).

```powershell
npm install
Copy-Item backend/.env.example backend/.env
# Edit backend/.env with your private MongoDB Atlas connection string and JWT secret.
npm run seed
npm run create-admin
npm run dev
```

Open http://localhost:5173. The API uses http://localhost:3001/api.
The backend must be connected to Atlas; there is no fake persistence fallback.
See [step-by-step external setup](docs/SETUP.md). The user creates GitHub and Atlas themselves.

Environment: backend PORT, MONGO_URI, CLIENT_ORIGIN, JWT_SECRET, and optional JWT_TTL_HOURS. Generate a private JWT_SECRET of at least 32 bytes and keep it only in backend/.env. Optional frontend VITE_API_URL defaults to http://localhost:3001/api. Never put database credentials or JWT secrets in a VITE_ variable.

## Implemented

- Eight frontend pages: landing, recommendation, planner, catalog, login, registration, account, and admin user management; plus a not-found view.
- Five database models, read-only planning routes, six processing routes, and six account/administration routes.
- Customer registration and login with bcrypt password hashes and JWT sessions stored in HttpOnly cookies.
- Server-side customer/admin authorization, protected frontend routes, current-user lookup, logout, and guarded user-role management.
- Interactive first-admin provisioning; public registration cannot select a role, self-demote an admin, or demote the final active administrator.
- Compatibility and memory quantity checks, power headroom, balance warnings, profile minimum notes.
- Budget allocations with exact rounding and editable locks.
- Feasibility-based recommendations and priority upgrades within the total budget.
- Session draft and printable build sheet.
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
| POST | /auth/register | Create a customer account and begin a session | `{ "name": "Alex Cruz", "email": "alex@example.com", "password": "private password" }` | `{ "user": { ... } }` or validation/duplicate error |
| POST | /auth/login | Begin a customer or admin session | `{ "email": "alex@example.com", "password": "private password" }` | `{ "user": { ... } }` or 401 |
| GET | /auth/me | Read the signed-in account | HttpOnly session cookie or Bearer token | `{ "user": { ... } }` or 401 |
| POST | /auth/logout | Clear the session cookie, even if the database is unavailable | — | `{ "message": "Signed out." }` |
| GET | /admin/users | List users; admin only | Authenticated admin session | `{ "users": [] }` or 401/403 |
| PATCH | /admin/users/:id/role | Assign customer/admin role; admin only | `{ "role": "admin" }` | `{ "user": { ... } }` or 400/401/403/404/409 |

Errors use `{ "message": "..." }`, optionally `fields`. Invalid input: 400; missing record: 404; duplicates: 409; database unavailable: 503; unexpected server failure: 500.

Browser authentication uses a credentialed, HttpOnly, SameSite=Lax cookie. The API also accepts an `Authorization: Bearer TOKEN` header for non-browser clients. The token contains only the user ID; protected requests reload the active user and current role from MongoDB.

## Validation

Verified October 8, 2026: `npm test` passed all 26 backend checks, including password hashing, JWT constraints, cookie attributes, 401/403 behavior, role safeguards, credentialed CORS, and all 16 existing planning checks. `npm run build` passed strict TypeScript checking and the Vite production build. The dependency audit reported zero vulnerabilities. Live Atlas-backed registration, login, admin provisioning, and role changes still require the user's private backend/.env and have not been claimed from the automated run. Earlier catalog/database and browser checks remain recorded in CONTEXT.md and CHANGELOG.md.

## Remaining work and limitations

Persistent saved builds and ownership, requests, catalog/configuration CRUD, password recovery, account deactivation workflows, reports, price snapshots, showcase, and remaining course pages/endpoints are pending. The project now has five collections and 17 documented API routes, but is not yet the full course submission target of at least 20 endpoints and 10 pages.

Catalog prices and performance scores are educational samples adapted from the supplied prototype. Score gaps are rough indicators, not benchmark-based bottleneck predictions. This implementation and its design are independently adapted, not copied verbatim.

Socket equality alone does not verify BIOS support. Storage connectors, GPU/case clearance, PSU connectors, coolers, fans, peripherals, monitors, and operating systems are outside these checks. A discrete GPU is always required by this first seven-category planner; integrated-graphics-only builds are not supported. Memory capacity is treated as capacity per selectable unit; catalog entries must use a consistent stick/kit convention before production use.

Recommendation is a heuristic; category locks are allocation targets. It does not claim a globally optimal build or enforce category caps during leftover upgrades. Candidate checks cover the supported rules only. To switch platforms, remove the conflicting selected parts first. Picker options refresh when selections/quantities change; a reload also refreshes changed shop settings. Model-specific image URLs can be supplied through Component.imageUrl; bundled sample-photo metadata is used when an existing sample record has no image URL, without modifying its stored price or specs. Photos are hosted by external manufacturer/retailer sites and require internet access.

Preview screenshots: [catalog photos](docs/catalog-photos-preview.jpg), [compatibility picker](docs/planner-compatible-options-preview.jpg), and [mobile planner](docs/planner-mobile-preview.jpg). Add the remaining final submission screens as team modules are completed.

Read [CONTEXT.md](CONTEXT.md) and [CHANGELOG.md](CHANGELOG.md) for handovers.
