# PC Build Planner — Team Context

Updated October 9, 2026. This file describes the actual local implementation.

## Project and structure

PC Build Compatibility and Budget Planning System for CTADWEBL, NU Clark.
One GitHub repository with `frontend/`, `backend/`, and a root README.
Use VS Code to open the repository root. npm workspaces share one lockfile.

## Implemented core

- React/Vite/TypeScript, Tailwind theme, React Router, axios, React Hook Form/Zod.
- Ten frontend pages: landing, recommendation, manual planner, component catalog, shared account page, admin users, admin component creation, saved builds, build details, and admin reports/review. Old account URLs redirect to /auth; unknown routes redirect Home.
- Express/Mongoose API with 30 method/path endpoints and eight models: Component, AllocationProfile, CheckSetting, BalancePair, User, Session, Build, BuildRequest.
- Hard checks: CPU socket, memory type, board/case fit, PSU headroom. Additional quantity check for motherboard memory slots.
- Exact whole-peso budget allocations with locks; overcommitted locks are rejected.
- Recommendation feasibility search with priority upgrades. Complete recommendations fit the total budget; inadequate budgets return an explanation and minimum known cost.
- Sample seed preserves existing records and edits. Prices/scores are illustrative.
- Catalog now contains 34 components after adding two per category: five each for CPU, motherboard, memory, GPU, storage, and PSU, and four cases. The additions were seeded into Atlas on October 7; all entries passed schema validation and the API returned 34 records with image metadata. All 16 backend tests passed with the expanded catalog.
- Print build sheet. Unsaved drafts survive page navigation in the current session; named builds persist in MongoDB with owner isolation and historical parts/prices.
- Minimalist neutral charcoal/white themes with an icon-only header toggle; dark by default with local browser preference persistence.
- Visual refinement adds an amber accent, a code-native PC tower illustration, stronger homepage typography, numbered guidance cards, catalog category tabs/counts, sample-score bars, and a planner budget-use meter. Both themes remain supported, with no gradients or new dependencies. Browser checks covered desktop light/dark views and 375px home/catalog/planner layouts; category tabs filtered correctly and the meter reflected the current total. Final frontend build passed.
- Catalog and planner thumbnails use per-model photo metadata, with explicit variant captions and source links. Component.imageUrl overrides bundled sample photos; existing sample records receive metadata in read-only API responses without reseeding.
- POST /api/component-options evaluates every candidate using the same backend hard checks as final validation. Incompatible/out-of-stock choices are disabled before selection. Existing parts can be removed when switching platforms. Above-budget and warning-only parts remain selectable.

## Intended behavior

Seven tower categories are required for a complete build, including a discrete GPU.
Hard errors and missing categories block readiness. Warnings and profile minimum notes do not.
Manual builds may exceed budget. Recommendation builds must stay within it.
Memory/storage allow quantities of identical components; other categories require quantity 1.
Allocation locks are budget targets, not fixed component selections or hard purchasing caps.
Recommendations are a heuristic, not a globally optimal hardware optimizer.
Compatibility means supported checks only; BIOS support, connectors, GPU clearance, cooling, and other physical details are outside this first implementation.

## Handover modules

Customer registration, login, logout, and session-based customer access are now implemented at the user's request. Coordinate further authentication/admin work with the assigned team members. No dummy login or unauthenticated role switch is implemented. Admins can assign the supported account roles.
User and Session models now exist. Public registration always creates a customer; customer and admin login share the account page. A controlled first-admin bootstrap script is provided. Atlas credentials remain backend connection credentials, not application logins.
Customer passwords use salted scrypt hashes; opaque seven-day sessions use HttpOnly, SameSite=Lax cookies and hashed tokens in MongoDB. Expiry is checked on each protected API request. The first-admin setup script is backend/createAdmin.js; run npm run create-admin -w backend with the documented temporary environment values. Public registration must not allow users to assign themselves the admin role. Keep initial admin credentials outside source control and document the setup procedure without passwords.
Catalog creation is available only to authenticated admins via POST /api/admin/components; there are no public catalog/config mutation routes.
Component editing/archiving, admin allocation/check configuration, showcase, authenticated live-flow QA, and final submission review remain for the team. Saved builds use embedded item relations and server-derived snapshots; ownership, request transitions, and reports are implemented.
Shared frontend contracts are in `frontend/src/types/index.ts` and `frontend/src/types/builds.ts`; update them alongside backend schemas.
The existing prototype is a feature reference, not a source-faithful implementation or design to copy.

## External setup

Latest October 9 verification: all 30 backend tests, the production build, and isolated browser checks passed. The Atlas-backed API serves 34 components. Live read-only checks confirmed report aggregation, the active-request unique index, and guest access protection. Authenticated live-flow and final submission QA remain.

Atlas is configured. The user supplied https://github.com/Tykes-dev/PCBuildPlanner as the target GitHub repository. Remote access must be verified with an authenticated account before fetching or publishing a branch.
The user created/configured Atlas and seeded the sample data. No remote GitHub repository has been created by the assistant.
Store Atlas credentials only in ignored backend/env (the local launcher uses this filename); never in frontend variables.
Read README and docs/SETUP.md for setup. Do not claim live database verification before connecting and seeding.

## Team workflow

Use your own GitHub identity for your meaningful contributions. Once authenticated, fetch the configured origin and review its default branch before starting new work.
Work on a feature branch. Read and understand your changes before committing.
Update CHANGELOG.md and this context when handing off. Record what works, what remains, and the next step.
The implementation now meets the course's numerical targets of at least 20 endpoints, 10 pages, and five related collections. Final review must still assess documentation, actual relationships, integration, and the remaining rubric requirements.

## October 9 customer access update

- Guests see the public landing page at /, can browse /components, and can register or log in. Planner and recommendation pages require customer login.
- GET /api/components and GET /api/components/:id remain public; profiles and all planning operations require a valid customer session. Health remains public for readiness checks.
- Registration uses name, normalized email, and a 12–128 character password; the frontend also confirms the password. Registration and login share /auth, and successful registration switches that page to the login form with the email retained.
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout are implemented. The shared login accepts customer and admin accounts.
- Logout revokes the session. Frontend checks the session on startup/focus, redirects on authentication failures, and resets the draft when the account changes.
- Auth attempts are limited to 20 per IP per 15 minutes in each server process. Production multi-instance hosting needs a shared limiter and explicit trusted proxy setup.
- Use the same hostname for frontend/API in development; the default API URL follows the frontend hostname on port 3001. Production requires HTTPS and same-site frontend/API hosting (or an /api reverse proxy), plus CLIENT_ORIGIN and VITE_API_URL configuration.
- Initial admin creation is via npm run create-admin -w backend with temporary ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD variables in ignored backend/env. Admins can list users and change customer/admin roles; role changes revoke sessions, and the last administrator cannot be demoted.

## October 9 role-access follow-up

- Guests can open Home, Components, and the shared /auth page. Planner/recommend routes are login-protected.
- Both customers and admins can log in and restore sessions; admins route to /admin/reports, customers to Home.
- Admin API routes list up to 500 accounts and change account roles. Server checks admin role for every request. Role changes revoke sessions; last-admin protection is enforced.
- First-admin script reads MONGO_URI from backend/env and ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from process environment. The bootstrap script refuses to overwrite/promote an existing email.
- Added backend/env to .gitignore. Initial admin values should be removed from backend/env after creation.
- Frontend production build and backend JavaScript syntax checks passed. No backend tests were run for this follow-up.


## October 9 admin catalog and shared account page

- Admins can add components at /admin/components via POST /api/admin/components. The form collects general details, numeric prices/scores/power/stock, availability, optional image metadata, and category-specific compatibility fields.
- Creation requires an admin session on the server. Payload fields are allowlisted, numeric values are checked without coercion, duplicate brand/name combinations return 409, and field errors return 400 with fields. New components are active and use existing catalog/planner queries. Startup waits for the Component uniqueness index.
- Public landing/header now have one Log in / Register link to /auth. Login and registration are two modes within this single page. Old /login and /register URLs redirect there.
- Registration retains the email and switches to the login form with a success message. Customer login from /builder or /recommend returns to that requested page; admin login routes to /admin/reports.
- The existing planner remains customer-only. A running local instance uses frontend port 5173 and API port 3001. run-app.bat starts/reuses those servers and opens Home after a key press.
- Verification: all 23 backend tests passed and the final TypeScript/Vite build passed. Headless Edge checks covered combined auth modes, mismatch/success feedback, planner return after login, role guards, all category form variants, creation success/field errors, category-only payload, and 375px layout without overflow. These browser/API creation checks used mocks, not live catalog writes.
- Live API restart succeeded: health reported database connected, catalog still returned 34 records, guest POST /api/admin/components returned 401, frontend /builder served 200. No test accounts/components were added to Atlas.
- QA screenshots: docs/account-page-preview.jpg and docs/admin-components-mobile-preview.jpg (mock accounts and a simulated field-error state).

## October 9 saved builds, requests, and reports

- Customers can save named planner drafts, list them at /builds, and open /builds/:id for saved parts, totals, rename, duplicate, reopen, and request history. Reopened drafts can update the original or be saved as a new build.
- Build stores an owner reference, an AllocationProfile reference and slug, embedded Component references/quantities with server-derived snapshots, and a saved total. Empty, incomplete, incompatible, and over-budget drafts can be saved. Clients cannot set owners, totals, or component snapshots.
- Every saved-build read/write and request submission is scoped to the current customer. Foreign build IDs return 404. Admins use their reporting/review routes; customer build routes require the customer role.
- Details and duplication preserve saved prices/specifications. Reopen resolves current catalog prices/specs, removes missing/archived/out-of-stock parts, and explains changes. Low stock quantities remain editable with a notice. An inactive saved profile falls back to an active default or available profile; no active profile returns a clear error.
- Requests resolve the current build/catalog again, require all seven categories and supported compatibility checks to pass, enforce current availability and tracked stock quantity, and capture an independent immutable submission snapshot. Manual over-budget builds are allowed; admins see both budget and submission total.
- BuildRequest references the owner, saved Build, and reviewing User. Pending/approved requests are active; a unique partial index allows only one active request per owner/build. Rejected/completed requests permit a later new submission.
- Admins review requests at /admin/reports and may move pending to approved or rejected, then approved to completed, with optional remarks. Closed requests cannot transition again. Conditional status writes and the expectedStatus field reject stale updates.
- Requests do not reserve or deduct stock. Later edits/renames to a saved build do not modify a request's submission snapshot.
- Customer/admin request lists show the latest 200 requests and label that limit. Dashboard totals/status counts cover all requests and saved builds. Top 10 component selections are grouped from saved builds, including duplicated drafts; selections count containing builds and units include memory/storage quantities. Catalog names are used when present, with saved names as fallback.
- Admin login, restored admin sessions, and the admin brand/Home link now open /admin/reports. Customer/public Home behavior remains as documented.
- The app now has 10 frontend pages, 30 method/path API endpoints, and eight models: Component, AllocationProfile, CheckSetting, BalancePair, User, Session, Build, and BuildRequest. The course's numerical page/endpoint/collection targets are met; final integration and submission QA remain.
- Verification for this update: all 30 backend tests passed using mocked persistence for new ownership, snapshot, request, transition, and report checks. No test builds, requests, accounts, or components were written to the live database in these checks. Final TypeScript/Vite build and mocked headless Edge checks passed. See the final integration notes below.

## October 9 final saved-build/report verification

- Production TypeScript/Vite build passed; new pages load in separate route chunks.
- Headless Edge with mock API data verified empty draft saving, renaming, duplication, reopening notices/current prices, seven-category selection, updating, Save as new, incomplete request feedback, active-request guard, submitted parts display, search, role guards, and request snapshots surviving later saved-build changes.
- Admin checks covered approve, complete, reject, filters, counts, customer remarks/history, empty reports, and a simulated refresh failure after a successful status write. The updated card remains correct while the page explains stale report totals.
- Visual review confirmed desktop and 375px details/dashboard layouts without horizontal overflow. Build actions stack below the title on phones, and account navigation wraps onto its own row.
- Updated API is running on port 3001 with Atlas connected; website runs on port 5173. Live public catalog still contains 34 components. Guest saved-build, request, and report endpoints return 401.
- Read-only live aggregation returned zero saved builds and requests; all four status counters returned zero; the active-request unique partial index exists. No test accounts, builds, requests, or components were created in Atlas. Authenticated mutations were verified with isolated mocks.
- Preview screenshots use simulated accounts/data: docs/saved-build-details-preview.jpg, docs/saved-build-mobile-preview.jpg, docs/admin-reports-preview.jpg, docs/admin-reports-mobile-preview.jpg.

## October 9 GitHub branch preparation

- Requested origin: https://github.com/Tykes-dev/PCBuildPlanner.git.
- Git has been initialized in this existing download; HEAD names feature/saved-builds-and-reports, with no commits yet.
- No remote base/history has been fetched and no branch has been pushed. Unauthenticated GitHub access returned 404, which does not distinguish a private repository from an unavailable URL.
- Git Credential Manager has no stored GitHub account. Authenticate an account with repository access before fetching the default branch and publishing this work.
- Preserve the existing workspace when aligning with remote history. backend/env, other environment files, node_modules, generated dist output, and private-key files remain ignored.
- Do not claim remote branch creation or a published commit until verified.

## October 10 publication handover

Prepared feature/saved-builds-and-reports against origin/main for publication at the user's request. All 30 backend tests and production build passed. Private environment files remain ignored. A live read-only Atlas check timed out; database availability requires a fresh check. Current teammate setup is documented at the top of docs/SETUP.md.

