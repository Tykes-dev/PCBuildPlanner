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

- Four frontend pages: landing, recommendation, planner, catalog; not-found view.
- Four database models, read-only data routes, and six processing routes.
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

Errors use `{ "message": "..." }`, optionally `fields`. Invalid input: 400; missing record: 404; duplicates: 409; database unavailable: 503; unexpected server failure: 500.

## Validation

Verified October 7, 2026: `npm test` passed all 16 backend service/API checks after expanding the catalog to 34 components. All 34 entries passed Mongoose schema validation, and all 14 new photo URLs returned image responses. MongoDB category counts and the running API confirmed 34 records with image metadata. The earlier `npm run build` passed strict TypeScript checking and the Vite production build. Earlier browser checks confirmed AM5 boards are disabled after choosing an AM4 CPU, and DDR5 memory is disabled with a DDR4 board. A 375px-wide preview had no horizontal overflow. These checks do not establish complete end-to-end verification of future team modules.

## Remaining work and limitations

Authentication/roles, persistent saved builds and ownership, requests, admin CRUD/configuration, reports, price snapshots, showcase, and remaining course pages/endpoints are pending. This core is not yet the full course submission (20 endpoints, 10 pages, five related collections for the excellent database band).

Catalog prices and performance scores are educational samples adapted from the supplied prototype. Score gaps are rough indicators, not benchmark-based bottleneck predictions. This implementation and its design are independently adapted, not copied verbatim.

Socket equality alone does not verify BIOS support. Storage connectors, GPU/case clearance, PSU connectors, coolers, fans, peripherals, monitors, and operating systems are outside these checks. A discrete GPU is always required by this first seven-category planner; integrated-graphics-only builds are not supported. Memory capacity is treated as capacity per selectable unit; catalog entries must use a consistent stick/kit convention before production use.

Recommendation is a heuristic; category locks are allocation targets. It does not claim a globally optimal build or enforce category caps during leftover upgrades. Candidate checks cover the supported rules only. To switch platforms, remove the conflicting selected parts first. Picker options refresh when selections/quantities change; a reload also refreshes changed shop settings. Model-specific image URLs can be supplied through Component.imageUrl; bundled sample-photo metadata is used when an existing sample record has no image URL, without modifying its stored price or specs. Photos are hosted by external manufacturer/retailer sites and require internet access.

Preview screenshots: [catalog photos](docs/catalog-photos-preview.jpg), [compatibility picker](docs/planner-compatible-options-preview.jpg), and [mobile planner](docs/planner-mobile-preview.jpg). Add the remaining final submission screens as team modules are completed.

Read [CONTEXT.md](CONTEXT.md) and [CHANGELOG.md](CHANGELOG.md) for handovers.
