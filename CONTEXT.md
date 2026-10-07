# PC Build Planner — Team Context

Updated October 7, 2026. This file describes the actual local implementation.

## Project and structure

PC Build Compatibility and Budget Planning System for CTADWEBL, NU Clark.
One GitHub repository with `frontend/`, `backend/`, and a root README.
Use VS Code to open the repository root. npm workspaces share one lockfile.

## Implemented core

- React/Vite/TypeScript, Tailwind theme, React Router, axios, React Hook Form/Zod.
- Landing, recommendation, manual planner, component catalog, not-found route.
- Express/Mongoose API and four models: Component, AllocationProfile, CheckSetting, BalancePair.
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

## Intended behavior

Seven tower categories are required for a complete build, including a discrete GPU.
Hard errors and missing categories block readiness. Warnings and profile minimum notes do not.
Manual builds may exceed budget. Recommendation builds must stay within it.
Memory/storage allow quantities of identical components; other categories require quantity 1.
Allocation locks are budget targets, not fixed component selections or hard purchasing caps.
Recommendations are a heuristic, not a globally optimal hardware optimizer.
Compatibility means supported checks only; BIOS support, connectors, GPU clearance, cooling, and other physical details are outside this first implementation.

## Handover modules

Authentication and role-based access are assigned to other members. No dummy login or role switch is implemented.
No application User model, users collection, or application admin account exists yet. The Atlas database user in backend/.env is a backend connection credential, not a PC Build Planner login.
The authentication owner should implement the User model, password hashing, login/session handling, and server-side role checks, then provide a controlled setup script to create the initial admin account. Public registration must not allow users to assign themselves the admin role. Keep initial admin credentials outside source control and document the setup procedure without passwords.
No public catalog/config mutation routes exist until authorization is added.
Saved builds, BuildItem relations, ownership, requests and their status transitions, admin CRUD/configuration, reports, and price snapshots remain for the team.
Shared frontend contracts are in `frontend/src/types/index.ts`; update them alongside backend schemas.
The existing prototype is a feature reference, not a source-faithful implementation or design to copy.

## External setup

Verification on October 7: all 16 backend tests and the frontend production build passed. The local Atlas-backed API serves 34 components; prior live browser checks verified disabled socket/memory mismatches and a narrow planner layout without horizontal overflow. Broader integration and final submission QA remain pending.

The user will create GitHub and Atlas personally with step-by-step guidance.
The user created/configured Atlas and seeded the sample data. No remote GitHub repository has been created by the assistant.
Store Atlas credentials only in ignored `backend/.env`; never in frontend variables.
Read README and docs/SETUP.md for setup. Do not claim live database verification before connecting and seeding.

## Team workflow

Use your own GitHub identity for your meaningful contributions. Pull before starting once a remote exists.
Work on a feature branch. Read and understand your changes before committing.
Update CHANGELOG.md and this context when handing off. Record what works, what remains, and the next step.
The complete course project still needs at least 20 endpoints, 10 pages, and five well-related collections for the highest database rubric band.
