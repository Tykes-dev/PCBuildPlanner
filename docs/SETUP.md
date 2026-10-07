# Setup and team handover

## GitHub — user performs these steps

1. Sign in to your own GitHub account and create an empty repository named PCBuildPlanner.
2. Select Public for direct instructor access, or Private and invite the instructor and teammates.
3. Do not initialize a README, license, or .gitignore; local files already exist.
4. In VS Code, open F:\CodeSamples\PCBuildPlanner and open Terminal > New Terminal.
5. Run `git init -b main`: initializes local history using main.
6. Check `git config user.name` and `git config user.email`. If necessary set repository-local values with `git config user.name "Your Name"` and `git config user.email "YOUR_GITHUB_EMAIL"`.
7. Run `git add .`: stages the project while respecting .gitignore.
8. Review `git status`, `git diff --cached --stat`, and `git diff --cached`. Check that secrets are absent. Use `git check-ignore -v backend/.env` after creating it.
9. After review, run `git commit -m "core: initialize PC build planner"`.
10. Run `git remote add origin YOUR_REPOSITORY_HTTPS_URL`, then `git push -u origin main`. Sign in through the browser if prompted. Do not put access tokens into the URL.
11. Invite teammates through repository Settings > Collaborators. Each clones the repository and contributes using their own identity.

## MongoDB Atlas — user performs these steps

1. Sign in at https://cloud.mongodb.com and create/select a project named PCBuildPlanner.
2. Create a Free cluster (M0), choose a nearby available region, and give the cluster a recognizable name.
3. Create a database user with a generated password, granting read/write access to the pcbuildplanner database. This is separate from your Atlas website account. Keep the password private.
4. Add your current public IP to the project network access list. Each teammate running the backend needs their IP permitted and their own database credentials.
5. Open Connect > Drivers and select Node.js. Copy the connection string privately.
6. Copy backend/.env.example to backend/.env. Replace the placeholders in MONGO_URI and use pcbuildplanner as the database name. URL-encode special characters in the password if needed.
7. From the repository root run `npm run seed`. MongoDB creates the database and its collections when records are written; manual collection creation is unnecessary.
8. Run `npm run dev`. Open http://localhost:5173 and check http://localhost:3001/api/health for a connected database.

Only the user should execute account setup and Git commit/push steps. The assistant prepares local source and validates it.

## Next members

- Accounts: add User model, bcrypt hashing, JWT verification, requireAuth/requireAdmin, login/register UI, and route guards. Frontend guards are not a substitute for backend authorization.
- Builds/requests: add Build, BuildItem, BuildRequest models and ownership checks; wire planner save/import to persistent IDs and price snapshots.
- Catalog/config: add protected CRUD and React Hook Form/Zod forms, server validation, confirmations, success feedback, default-profile handling, and pair canonicalization on updates.
- Reports: aggregate real builds/requests; do not use hardcoded chart counts.
- UI completion: compatibility-ranked picker, detailed specs, settings forms, saved-build/request screens, and mobile/browser QA.
- Course submission: fill group names, screenshots, full API examples, and remaining pages/endpoints in README; rehearse validation and not-found examples.
