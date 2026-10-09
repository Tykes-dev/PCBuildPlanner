# Changelog

## 2026-10-08 — Live Atlas and administrator setup

- Moved the user's local environment file to ignored `backend/.env` and validated MONGO_URI, CLIENT_ORIGIN, JWT_SECRET, and JWT_TTL_HOURS without logging their values.
- Refreshed the Atlas Drivers connection string, targeted the `pcbuildplanner` database explicitly, and confirmed a live database connection.
- Created the first application administrator with the masked interactive setup command; a read-only database check confirmed exactly one active admin without displaying account details.
- Live verification passed: `GET /api/health` reported connected, `GET /api/components` returned all 34 seeded records, and the Vite frontend returned HTTP 200.
- Recorded the Windows execution-policy workaround: use `npm.cmd run create-admin` and `npm.cmd run dev` when PowerShell blocks `npm.ps1`; no machine-wide policy change is required.
- The Atlas password and JWT secret appeared in setup screenshots. They are not written to source or documentation, but must be rotated before deployment, repository sharing, expanded Atlas network access, or other non-local use.

## 2026-10-08 — Authentication and role-based access

- Added the User model with normalized unique emails, hidden bcrypt password hashes, customer/admin roles, active status, and last-login timestamps.
- Added register, login, logout, and current-user endpoints using JWTs in HttpOnly SameSite=Lax cookies, with Bearer-token fallback for non-browser clients. Tokens contain only a user ID; protected requests reload the active user and current role.
- Added requireAuth/requireAdmin middleware, credentialed CORS, shared database-readiness handling, safe 401/403 errors, admin user listing, and guarded role updates.
- Public registration rejects role input and always creates a customer. Admin role management blocks self-demotion and demotion of the final active administrator.
- Added a masked interactive `npm run create-admin` workflow. The admin password is not stored in source, documentation, a command argument, or a public frontend variable.
- Added login, registration, account, and admin user-management pages; auth-aware navigation; credentialed axios; protected/admin route guards; shared role contracts; and responsive styling. Existing planning pages remain public.
- Added backend-only JWT_SECRET/JWT_TTL_HOURS configuration and startup validation. Private values belong in ignored backend/.env; Atlas credentials remain separate from application logins.
- Added bcryptjs and jsonwebtoken. The dependency audit reported zero vulnerabilities.
- Validation: all 26 backend tests passed and the strict TypeScript/Vite production build completed. Subsequent live Atlas and first-admin verification is recorded in the entry above.

## 2026-10-07 — Interface visual refinement

- Redesigned Home.tsx with a split hero, BuildIllustration.tsx SVG tower, feature strip, and numbered guidance cards.
- Refined styles.css and App.tsx with restrained amber accents, a processor brand icon, active navigation underline, clearer typography, and footer.
- Updated Catalog.tsx with category tabs/counts, product labels, larger prices, and clearly labeled sample-score bars. Search and the category dropdown share the same filter state.
- Added an accessible budget-use meter and selected-category count in Builder.tsx, using the existing plan totals.
- Preserved light/dark themes, icon-only toggle, compatibility behavior, and print controls. No gradients, database changes, or new dependencies.
- Verified the frontend production build, desktop light/dark views, category filtering, planner meter, and 375px home/catalog/planner layouts without horizontal overflow. Preview screenshots are in docs/refined-*.jpg.

## 2026-10-07 — Expanded component catalog and admin handover

- Added two sample components per category in backend/data/catalog.js, bringing the catalog from 20 to 34 records.
- Added product photo metadata/source links in backend/data/componentImages.js, with explicit model-family captions where appropriate.
- Ran the insert-only seed against Atlas; existing records were preserved. Database category counts and GET /api/components confirmed 34 records, all with image metadata.
- All 34 records passed Mongoose schema validation; all 14 new photo URLs returned image responses; all 16 backend tests passed with the expanded catalog.
- Clarified in CONTEXT.md that application users/admin accounts are pending and belong to the authentication owner. Atlas credentials are separate from website logins.
- Sample prices, scores, and non-GPU/CPU power estimates remain educational values. No dependencies changed; no Git commit or remote push performed.

## 2026-10-07 — Initial core implementation (not committed)

- Created npm workspace with frontend/ and backend/.
- Added compatibility, quantity, power, budget allocation, and recommendation services.
- Added read-only catalog/profile endpoints and five processing endpoints.
- Added four Mongoose models and a non-destructive sample seed.
- Built four frontend pages and a not-found view, with API feedback and form validation.
- Added unit/API checks and handover documentation.
- Deferred accounts, roles, persistent builds, shop requests, admin editing, reports, and live service setup.

Validation results are recorded in README once checks complete. This entry does not claim a Git commit or remote push.

## 2026-10-07 — Verification after resuming

- All 10 service/API tests passed, including allocation rounding, compatibility, quantity, power-margin changes, recommendation feasibility, and API error responses.
- Strict TypeScript checking and the Vite production build passed.
- Added a shell-quote override to use the patched release and ignored generated TypeScript build metadata.
- Dependency installation audit reported zero vulnerabilities after the override.
- Atlas integration and browser/mobile visual checks remain pending. Git is not initialized; no remote actions performed.

## 2026-10-07 — Light and dark themes

- Added a header theme toggle and useTheme hook, defaulting to dark and remembering the browser preference.
- Updated shared color tokens for panels, navigation, inputs, buttons, and feedback in both themes.
- Added a dark green gradient hero and preserved light print output.
- No dependencies added.

## 2026-10-07 — Minimalist theme refinement

- Replaced the green palette with neutral charcoal and white themes.
- Removed hero gradients, panel shadows, and boxed process cards; simplified typography and surfaces.
- Made the theme control icon-only while retaining its accessible label and saved preference.
- No dependencies changed.

## 2026-10-07 — Database setup diagnostics

- Validate missing URI, placeholders, protocol, and database name before attempting connection.
- Seed errors now distinguish configuration, authentication, connection, validation, and duplicate-record failures without logging credentials.

## 2026-10-07 — Local preview API connection

- Development CORS now permits both localhost:5173 and 127.0.0.1:5173; production uses CLIENT_ORIGIN.
- Extended the API test to check both development origins and reject an unrelated origin.

## 2026-10-07 — Catalog photography and proactive compatibility

- Added optional imageUrl, imageSource, and imageCaption fields to Component and mirrored frontend contracts.
- Added a 20-model photo/source map in backend/data/componentImages.js. Read-only catalog responses fill missing sample photos; existing shop data is not rewritten. New sample records include photo metadata.
- Added ComponentImage with lazy loading, alt text, contain sizing, and an unavailable-photo fallback.
- Replaced planner selects with ComponentPicker cards showing pictures, disabled incompatible choices, short reasons, and Remove actions for changing platforms.
- Added evaluateComponentOptions and POST /api/component-options, reusing final validation rules and current PSU margin. useComponentOptions cancels stale requests and prevents selections while checks are pending.
- Preserved selectable over-target parts and warning-only builds. Options sort by compatibility, target fit, and price.
- Validation: all 16 tests and the production build passed; the running API returned 20 image-mapped records. Live browser verified socket/memory exclusions and no horizontal overflow at a 375px viewport. All 20 public image endpoints were checked for successful image responses after replacing two unavailable links.
- External photos require internet; variant captions distinguish model-family examples. No dependencies changed, no Git commit/push, and no credential files edited.
