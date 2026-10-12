# Changelog

## 2026-10-11 — Interface redesign, schema-backed forms, and entry-point restructure

- Reworked the shared administration table: one bordered frame now holds the search row, the table and the pager; sort arrows replaced the text indicator and turn amber when active; prices and scores use tabular figures; row hover marks the left edge with the same signal colour the active sidebar link uses.
- Added `components/Icon.tsx` with fourteen inline SVG icons plus `IconButton` and `IconLink`. Row actions across the catalog, use case, rules, planner and queue pages became 34px icon buttons carrying an accessible label and hover tooltip, with archive and remove tinted red on hover only. No icon dependency was added.
- Fixed a cascade fault in the navigation: `.nav-toggle` was declared outside a Tailwind layer, so its `display` beat the `md:hidden` utility at every width and the menu button showed on desktop. Show and hide now live in the same plain CSS block, collapsing below 1120px for a signed-in customer and below 768px for a guest.
- Made the header sticky, removed the role label from the account area, coloured the account name with the signal accent, and raised the content cap from 1152px to 1600px so the header, content and footer align on a desktop screen.
- Replaced the single-line footer with a four-column footer and a bottom bar, and made the page a flex column with a minimum height so the footer sits at the bottom of a short page.
- Fixed a width regression introduced with that flex column: `main` carries an automatic inline margin, which cancels cross-axis stretching, so every page sized to its own content and appeared centred in a narrow strip. The flex item now takes the full container width.
- Rebuilt the landing page below the hero: the feature strip was removed, a fact strip reports the live catalog count, three feature rows alternate sides with drawn product visuals in `components/LandingVisuals.tsx`, a four-question section was added, and a closing call-to-action band precedes the footer.
- Replaced the published-build carousel with a responsive grid in `components/ShowcaseBuilds.tsx`. A carousel holding a single card reserved a full-width row and drew arrows that did nothing.
- Redesigned the recommendation page: use case selection moved from a dropdown to cards showing each profile's description, the budget field gained a peso prefix and four presets, and results lead with a summary bar carrying total, budget, remainder, compatibility and a budget meter.
- Rebuilt saved builds around two tabs, each a full table with search, sorting, a status filter and pagination, with four figures in a strip above and deletion moved into a dialog.
- Rebuilt build details around one summary bar, a parts panel, a shop-review panel with a readiness check, and a vertical request timeline. Rename and submission moved into dialogs.
- Rebuilt the inquiry page: the form moved into a dialog, the page became a table with search, sorting, a status filter and pagination, and the shop's proposal opens in a dialog with accept and decline. The separate parts-list toggle was removed as duplicated.
- Added search, a five-way sort and pagination to the customer catalog, and removed the photo source link from the cards. Administrators still record the source.
- Added `imageUrl` to `Build`, accepted on `PATCH /api/builds/:id/visibility` with HTTPS validation, so a published build can show a photo of a finished unit. The field is set at publication, which keeps it off inquiry proposals. Omitting it leaves the stored photo untouched. A blurred copy of the photo fills the card frame behind the contained image, so any aspect ratio fits without cropping.
- Published builds now open in the planner through `/builder?from=<id>`, prefilling the parts, budget, use case and name, then clearing the parameter. The identifier travels in the URL so a guest who signs in first still arrives at a prefilled planner. Nothing links the draft back to the shop's build.
- Fixed focus loss in `components/Drawer.tsx`: the setup effect depended on the `onClose` identity, which callers recreate on every render, so each keystroke re-ran the effect and moved focus to the close button. The callback is now read through a ref and the initial focus lands on the first field.
- Added `components/NumberField.tsx`. A controlled number input stranded a typed leading zero, because "01" parses back to the value already held and React never rewrote the field. The planner budget and quantity fields now hold the typed text locally and settle on blur.
- Moved form validation into `frontend/src/schemas`: `component.ts`, `inquiry.ts`, `profile.ts` and `rules.ts` join the existing auth and recommendation schemas. The catalog, use case, rules-pair and inquiry forms now use React Hook Form with a Zod resolver, `z.infer` types and per-field errors, and both forms suppress native validation so schema messages always show. Server field errors are still merged onto the matching input.
- The four compatibility checks remain inline editors with one save button each and no form element. They validate against the same Zod schema without React Hook Form, and this is recorded as a known limitation.
- Separated the request logger, the cross-site write guard and the health route out of `app.js` into `middleware/logger.js`, `middleware/origin.js` and `routes/health.js`. The entry point now holds configuration and mounting only. The logger writes one line per response with the status code and duration.
- Rewrote README.md against the project brief: title, members with contributions, concept, what the application processes, seven current screenshots, setup and environment variables, an API table covering all 57 endpoints with sample requests and responses, features and known limitations.
- Verification: all 30 backend tests, strict TypeScript and the production Vite build passed after every change. The Zod schemas were compiled standalone and checked against the previous validation rules with 62 assertions covering every category, boundary and payload shape; all matched. Every customer page was walked at 375px with a DOM overflow check and reported nothing past the right edge.
- Current scope: 15 frontend pages, 57 API endpoints, nine models, six Zod schemas. No new dependencies were added.


## 2026-10-10 — Administration console redesign

- Administration moved into its own shell: a full-height sidebar grouped into Overview, Customer work, Shop setup and Access, with the brand, account, theme toggle and sign-out inside it. No footer, since the sidebar already carries that information.
- Below 1024px the sidebar collapses to a menu button that opens the same grouping. The customer navigation collapses the same way below 768px, replacing CSS that previously squeezed the links into an unreadable four-column grid.
- Added `frontend/src/hooks/useTableState.ts` and `frontend/src/components/DataTable.tsx`: one implementation of search, three-state sorting, filtering and pagination for every administration list. Columns may declare `hideBelow` so they drop out before a table has to scroll.
- Added `frontend/src/components/Drawer.tsx`: a centred dialog for forms and detail views that traps focus, closes on Escape and the backdrop, locks body scroll and returns focus to its opener. Below 640px it becomes a bottom sheet.
- Dashboard is now summary only. The review queue moved to the customer queue page, which carries two tabs: build inquiries and review requests, each a table with its own filters and a drawer for detail and actions. The tab is in the URL.
- Catalog, use cases and users became table-first. Add and edit open in a dialog instead of a long form above the list. Archive and restore act from the row.
- The component picker opens in a dialog with search, sorting and pagination, and an "only parts that fit" filter. This affects the customer planner as well, which is intended: an inline list does not scale with the catalog.
- The administration planner gained a second tab listing published landing-page builds, with edit and unpublish. Its print button was removed; customers keep theirs.
- Administration typography and spacing run denser than the customer pages, and content fills the width the sidebar leaves. Two competing width caps were removed.

## 2026-10-10 — Catalog CRUD, shop configuration, build inquiries, and the landing-page showcase

### Fixes
- `backend/config/db.js` accepted only single-host connection strings. `new URL()` cannot parse a comma-separated replica-set URI, so a valid multi-host MONGO_URI was reported as malformed. Validation now normalises to the first host; the original string is still what reaches mongoose.
- `backend/server.js` printed one generic sentence for every startup failure and discarded the real error. It now separates configuration problems from connection problems and prints the driver's own name and message.
- `frontend/src/pages/Builder.tsx` used the array index as a React key in the reopen notices. Replaced with the notice text.
- `frontend/src/pages/AuthPage.tsx` lost its Zod validation when Login and Register were merged into /auth on 2026-10-09; `frontend/src/schemas/auth.ts` had been deleted. Both restored, with the password rule corrected from 8-72 to the server's 12-128.
- Compatibility messages exposed raw category keys ("cpu and gpu differ by 32 score points"). `CATEGORY_LABELS` added to `backend/models/Component.js`; the balance warning now names the weaker part and what to do about it, and the power error appends the actual draw, requirement and supply rating.
- Severity codes "warning" and "note" were shown to customers verbatim. Now "Worth checking" and "Suggestion".

### Catalog
- Added `PUT /api/admin/components/:id`, `DELETE /api/admin/components/:id` (archives), `PATCH /api/admin/components/:id/restore`, and `GET /api/admin/components` (includes archived). Completes CRUD on the main collection.
- Updating clears specifications the new category does not use. The route loads and saves the document rather than using `findByIdAndUpdate`, because the schema's conditional `required` reads `this.category`, which is the query in an update context.
- Deleting archives rather than removes: saved builds reference components by id, and the entire read path already respected the existing `archived` flag.
- `AdminComponents.tsx` gained the catalog list, edit, archive, restore, filtering and search. Its form remains manual state; it was not converted to React Hook Form.

### Saved builds
- Added `DELETE /api/builds/:id`, refused with 409 while a pending or approved request exists. Deletion is permanent: a submitted request keeps its own immutable snapshot, so nothing downstream breaks.

### Shop configuration
- Added use case profile management at `/admin/profiles` with five endpoints. Profiles are archived, never removed, because saved builds reference them. Guards prevent archiving the default or the last active profile. A "Match priority to share" action renumbers priorities to follow the percentages.
- Added compatibility rule settings at `/admin/rules` with five endpoints. Administrators reword the four hard checks and set the power safety margin, and fully manage balance pairs. The hard checks deliberately have no off switch; the engine ignores their `active` flag by design.

### Build inquiries
- New `BuildInquiry` collection for customers whose use case no profile covers, with statuses open, answered, accepted, declined and closed. Deliberately separate from `BuildRequest`: the existing unique index on owner plus build cannot accommodate a request that starts without a build.
- Customer page at `/help`, reachable from the "My use case is not listed..." option on the recommendation page. Administrator queue at `/admin/inquiries`.
- Administrator planner at `/admin/plan` reuses the customer `Builder` through a new `actions` slot, so the compatibility engine, picker and budget split are not duplicated. Accepting a proposal copies the build into the customer's account; the shop's original is never altered afterwards.
- `POST /api/allocations` accepts an optional custom split, so the shop can answer a customer without assigning them a use case that does not fit. Priorities are derived from the shares. The split is per-request and never stored.
- `Build` gained `shopBuild` and `visibility`. Reports exclude shop builds from customer activity counts.

### Landing page
- Published builds appear in a snapping carousel on the landing page, public so visitors see them before signing in. Nothing published means the section does not render.
- Administrators publish, edit and unpublish from `/admin/plan`.

### Access changes
- `backend/routes/core.js` and `backend/routes/builds.js` moved from customer-only to any signed-in account. These routes read configuration, run the planning engine, or scope by owner; administrators need them to answer inquiries. Three test assertions that encoded the old customer-only rule were updated to match, each with a comment explaining why.

### Scope
- 11 frontend pages, 57 API endpoints, nine related models.
- Demonstration data: `backend/seedDemo.js` creates three customers, eight saved builds and four requests covering every status, removable with `npm run seed:demo -w backend -- --remove`.

### Verification
- All 30 backend tests, TypeScript, and the production Vite build pass. The inquiry flow was exercised end to end against the live Atlas database: customer inquiry, administrator proposal, customer acceptance, and the copied saved build.

## 2026-10-10 — Publication preparation

- Based the saved-builds-and-reports branch on existing GitHub main while preserving local work.
- Added current teammate setup instructions and clarified the two supported local environment filenames.
- Re-ran all 30 backend tests and the production build successfully. Atlas read-only connectivity timed out; no database records were changed.

## 2026-10-09 — Documentation and GitHub branch preparation

- Refreshed CONTEXT.md with the completed account, saved-build, request, and reporting scope, current validation results, and remaining authenticated live-flow/submission QA.
- Recorded https://github.com/Tykes-dev/PCBuildPlanner as the requested origin and initialized Git in the existing local download.
- Prepared feature/saved-builds-and-reports locally. No existing remote history has been fetched or changed; selecting the remote base and publishing require GitHub authentication.
- Existing local configuration remains ignored, including backend/env, environment files, dependencies, and generated frontend output.
- This handover changes documentation and Git setup only; earlier 30-test, production-build, isolated browser, and live read-only verification results remain applicable.

## 2026-10-09 — Saved builds, build requests, and admin reports

- Added customer Saved builds and Build details pages, planner save/update/save-as-new controls, rename, duplicate, and reopen actions.
- Added Build with owner/profile/component references, embedded server-derived part snapshots and saved prices/totals. All build operations filter by customer ownership; foreign IDs return 404 and clients cannot supply owners or snapshot prices.
- Saved details/duplicates retain historical values. Reopening refreshes live prices/specifications, removes unavailable parts with notices, preserves editable low-stock quantities, and falls back to an active profile when needed. Empty/incomplete/incompatible/over-budget drafts remain saveable.
- Added customer request submission/history and BuildRequest with an independent immutable current-catalog submission snapshot. Submission checks completeness, supported compatibility, availability, and tracked quantities; manual over-budget submissions remain allowed.
- Added admin reports/review at /admin/reports, now the default admin destination. Admins can approve/reject pending requests and complete approved requests with remarks. One active pending/approved request per owner/build is enforced by a unique partial index; stale or closed status transitions return 409.
- Reports show all-time saved-build/request totals, active counts, status breakdown, and top 10 components across saved selections, including duplicate drafts and quantity-aware unit counts. Request lists show the most recent 200 and label that limit.
- Requests do not reserve or deduct stock. Editing a saved build leaves existing submitted snapshots intact.
- Current scope: 10 frontend pages, 30 API endpoints, eight related models. Saved builds, ownership, requests, snapshots, and reports are no longer pending team modules.
- Verification: all 30 backend tests and the final TypeScript/Vite build passed. Headless Edge with mock APIs verified save/rename/duplicate/reopen/update/save-as-new, submission snapshots and feedback, role guards, admin transitions/counts/history, refresh-failure recovery, empty states, and desktop/375px layouts. Live read-only checks confirmed Atlas connection, 34 catalog records, zero initial builds/requests, the active-request unique index, and guest 401 responses. No live test records were created.
- Customer history exposes submitted parts. Submission copy explains current catalog prices/specifications. Successful admin writes update cards immediately; refresh failures explain stale totals. Responsive title/actions and expanded account navigation were verified on phones. New pages are lazy-loaded.

## 2026-10-09 — Admin component creation and one account page

- Added admin Add component navigation/page and POST /api/admin/components, with category-specific specs, optional photo metadata, strict input validation, clear duplicate/field errors, and server-side admin enforcement.
- New records enter the existing active catalog and customer planner queries. Backend startup initializes the Component unique index before listening.
- Combined Login and Register into /auth with in-page modes, one landing/header link, and redirects for old URLs. Registration switches to login with retained email and confirmation.
- Preserved requested planner/recommendation destination after customer login and admin role routing. Corrected the password help/label association.
- Verified 23 backend tests and final TypeScript/production build; headless browser checks covered shared auth, planner return, role guards, all category form fields, creation feedback and 375px layouts using mock API data.
- Restarted the live API, confirmed Atlas connected and 34 catalog records, verified guest creation denial, and opened the planner link. No test accounts/components or credentials were added to Atlas.
- Updated context/README and saved account/admin-form QA screenshots. The root run-app.bat launcher is documented.

## 2026-10-09 — Guest landing and admin role access

- Restored public Home at / for guests, with Components as a separate public tab; planner and recommendation routes require customer login.
- Shared login/session restoration now accepts admins as well as customers. Admins land on /admin/users.
- Added admin-only endpoints to list accounts and assign customer/admin roles. Role changes revoke sessions and the last administrator cannot be demoted.
- Added a first-admin bootstrap script (npm run create-admin -w backend) reading temporary ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from ignored backend/env. It will not promote an existing account.
- Added admin account management UI and excluded backend/env from version control.
- Frontend production build and backend syntax checks passed. No tests or live database role changes were run.

## 2026-10-09 — Customer registration and guest access restrictions

- Added User and Session models, customer-only registration, login, session lookup, and logout endpoints. Public registration cannot select an admin role.
- Added salted scrypt password hashing, normalized unique email addresses, opaque HttpOnly session cookies, hashed server-side session tokens, explicit expiry checks, session revocation, origin protection, and per-process auth attempt limits.
- Added registration/login pages with validation, password confirmation, feedback, and a registration-to-login flow.
- Guests can browse Home, Components, and auth pages. Planner/recommendation APIs independently enforce customer sessions.
- Added account-aware navigation, logout, startup/focus session checks, and draft isolation between accounts while preserving navigation drafts.
- Startup waits for User/Session indexes. Default local API hostname follows the frontend so cookie sessions work consistently with localhost or 127.0.0.1.
- Verified all 18 backend tests and the TypeScript/production build. Auth tests mock database persistence; live Atlas registration is not verified. Browser verification was blocked by a Windows sandbox helper initialization error.
- No new dependencies, admin accounts, remote commits, or credential changes.

## 2026-10-09 — Live Atlas and administrator setup


- Moved the user's local environment file to ignored `backend/.env` and validated MONGO_URI, CLIENT_ORIGIN, JWT_SECRET, and JWT_TTL_HOURS without logging their values.
- Refreshed the Atlas Drivers connection string, targeted the `pcbuildplanner` database explicitly, and confirmed a live database connection.
- Created the first application administrator with the masked interactive setup command; a read-only database check confirmed exactly one active admin without displaying account details.
- Live verification passed: `GET /api/health` reported connected, `GET /api/components` returned all 34 seeded records, and the Vite frontend returned HTTP 200.
- Recorded the Windows execution-policy workaround: use `npm.cmd run create-admin` and `npm.cmd run dev` when PowerShell blocks `npm.ps1`; no machine-wide policy change is required.
- The Atlas password and JWT secret appeared in setup screenshots. They are not written to source or documentation, but must be rotated before deployment, repository sharing, expanded Atlas network access, or other non-local use.

## 2026-10-09 — Authentication and role-based access


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
