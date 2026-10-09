# PC Build Planner — Team Context

Updated October 8, 2026. This file describes the actual local implementation.

## Project and structure

PC Build Compatibility and Budget Planning System for CTADWEBL, NU Clark.
One GitHub repository with `frontend/`, `backend/`, and a root README.
Use VS Code to open the repository root. npm workspaces share one lockfile.

## Implemented core

- React/Vite/TypeScript, Tailwind theme, React Router, axios, React Hook Form/Zod.
- Landing, recommendation, manual planner, component catalog, not-found route.
- Express/Mongoose API and five models: Component, AllocationProfile, CheckSetting, BalancePair, and User.
- Hard checks: CPU socket, memory type, board/case fit, PSU headroom. Additional quantity check for motherboard memory slots.
- Exact whole-peso budget allocations with locks; overcommitted locks are rejected.
- Recommendation feasibility search with priority upgrades. Complete recommendations fit the total budget; inadequate budgets return an explanation and minimum known cost.
- Sample seed preserves existing records and edits. Prices/scores are illustrative.
- Catalog now contains 34 components after adding two per category: five each for CPU, motherboard, memory, GPU, storage, and PSU, and four cases. The additions were seeded into Atlas on October 7; all entries passed schema validation and the API returned 34 records with image metadata. All 16 backend tests passed with the expanded catalog.
- Print build sheet. Draft survives page navigation in the current session only.
- Minimalist neutral charcoal/white themes with an icon-only header toggle; dark by default with local browser preference persistence.
- Visual refinement adds an amber accent, a code-native PC tower illustration, stronger homepage typography, numbered guidance cards, catalog category tabs/counts, sample-score bars, and a planner budget-use meter. Both themes remain supported, with no gradients or new dependencies. Browser checks covered desktop light/dark views and 375px home/catalog/planner layouts; category tabs filtered correctly and the meter reflected the current total. Final frontend build passed.
- Catalog and planner thumbnails use per-model photo metadata, with explicit variant captions and source links. Component.imageUrl overrides bundled sample photos; existing sample records receive metadata in read-only API responses without reseeding.
- POST /api/component-options evaluates every candidate using the same backend hard checks as final validation. Incompatible/out-of-stock choices are disabled before selection. Existing parts can be removed when switching platforms. Above-budget and warning-only parts remain selectable.
- Authentication now uses a fifth Mongoose model, User, with normalized unique email, bcrypt password hashes, customer/admin roles, active status, and last-login time. JWTs are stored in HttpOnly SameSite=Lax cookies, contain only the user ID, and are rechecked against the active database user on protected requests. Bearer tokens are also accepted for non-browser clients.
- Public registration always creates a customer and rejects role input. Login, logout, current-user, admin user listing, and guarded role-update endpoints are implemented. Server middleware distinguishes unauthenticated (401) from non-admin (403) access; self-demotion and removal of the final active administrator are blocked.
- The frontend has login, registration, protected account, and admin user-management pages; session-aware navigation; credentialed axios; and customer/admin route guards. Existing planning/catalog pages remain public.
- `npm run create-admin` launches a masked interactive first-admin setup. Admin credentials are never stored in source or accepted as command-line arguments.

## Intended behavior

Seven tower categories are required for a complete build, including a discrete GPU.
Hard errors and missing categories block readiness. Warnings and profile minimum notes do not.
Manual builds may exceed budget. Recommendation builds must stay within it.
Memory/storage allow quantities of identical components; other categories require quantity 1.
Allocation locks are budget targets, not fixed component selections or hard purchasing caps.
Recommendations are a heuristic, not a globally optimal hardware optimizer.
Compatibility means supported checks only; BIOS support, connectors, GPU clearance, cooling, and other physical details are outside this first implementation.

## Handover modules

Authentication and customer/admin role access are implemented locally. There is intentionally no dummy login or browser role switch. The Atlas database user in backend/.env remains a backend connection credential, not a PC Build Planner login.
Live setup is complete: ignored `backend/.env` exists with MONGO_URI, CLIENT_ORIGIN, JWT_SECRET, and JWT_TTL_HOURS; the Atlas URI targets the `pcbuildplanner` database; and one active application administrator was created through the masked interactive setup command. Do not rerun first-admin setup with the same email; the script intentionally refuses to replace or promote an existing account.
On this Windows machine PowerShell blocks the `npm.ps1` shim. Use `npm.cmd run dev`, `npm.cmd run create-admin`, and analogous `npm.cmd` commands, or use a shell where npm is permitted. Do not weaken the machine-wide execution policy just for this project.
No catalog/config mutation routes were added in this authentication pass. Future admin mutations must use the existing server-side requireAuth/requireAdmin middleware and must not rely only on frontend guards.
Saved builds, BuildItem relations, ownership, requests and their status transitions, admin CRUD/configuration, reports, and price snapshots remain for the team.
Shared frontend contracts are in `frontend/src/types/index.ts`; update them alongside backend schemas.
The existing prototype is a feature reference, not a source-faithful implementation or design to copy.

## External setup

Verification on October 8: all 26 backend tests and the frontend production build passed after authentication was added. Tests cover bcrypt hashing, JWT/cookie constraints, safe public serialization, 401/403 middleware behavior, role safeguards, database-unavailable handling, credentialed CORS, and the prior 16 planning cases. The dependency audit reported zero vulnerabilities.

Live setup was then verified against Atlas: the connection succeeded, `GET /api/health` returned `{"database":"connected"}`, `GET /api/components` returned all 34 seeded records, the frontend returned HTTP 200, and a database count confirmed one active admin. Registration/login through the browser and admin role changes should be the next manual QA pass.

The Atlas password and JWT signing value appeared in setup screenshots shared in chat. The user chose to continue for local coursework, but the next collaborator must treat both as exposed and rotate them before deployment, repository sharing, widening Atlas network access, or any non-local use. Never record replacement values in documentation, commits, screenshots, frontend variables, or chat.

The user will create GitHub and Atlas personally with step-by-step guidance.
The user created/configured Atlas and seeded the sample data. No remote GitHub repository has been created by the assistant.
Store Atlas credentials and JWT_SECRET only in ignored `backend/.env`; never in frontend variables.
Read README and docs/SETUP.md for setup. Do not claim live database verification before connecting and seeding.

## Team workflow

Use your own GitHub identity for your meaningful contributions. Pull before starting once a remote exists.
Work on a feature branch. Read and understand your changes before committing.
Update CHANGELOG.md and this context when handing off. Record what works, what remains, and the next step.
The complete course project still needs at least 20 endpoints, 10 pages, and five well-related collections for the highest database rubric band.
