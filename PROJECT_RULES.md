# Project Development Rules

## 1. Purpose

These rules define the reusable development architecture for a Vite/React frontend with a PHP/MySQL backend, XAMPP local development, Cloudflare client previews, Git/GitHub version control, and Z.com production hosting.

The current project's names and paths live in `PROJECT_PROFILE.md`. When this repository is duplicated, update that profile and complete `TEMPLATE_CHECKLIST.md` before feature development.

`SECURITY_RULES.md` is mandatory and applies together with this file.

## 2. Supported stack

### Frontend

- React
- Vite
- JavaScript/JSX
- CSS

### Backend

- PHP
- JSON APIs under `api/`
- Shared server code under `includes/`
- PDO with native prepared statements

### Data

- MariaDB/MySQL supplied by XAMPP locally
- phpMyAdmin as a database administration interface only
- A separate MySQL database and user on Z.com for production

### Environments

- Local development: XAMPP + Vite
- Client preview: a Vite production build served locally through a restricted Cloudflare Quick Tunnel
- Production: Z.com cPanel hosting
- Version control: Git and GitHub

Docker and Render are deliberately excluded. Do not introduce them without an explicit change in hosting strategy.

## 3. Canonical repository structure

```text
project-root/
├── api/                         Public PHP API endpoints
├── includes/                    Reusable non-public PHP modules
├── scripts/                     Local preview/development automation
├── src/                         React source code
├── .env                         Local secrets; never tracked
├── .env.example                 Placeholder environment-variable contract
├── .gitignore
├── .htaccess                    Apache protection/routing where applicable
├── index.html                   Vite HTML entry point
├── package.json
├── package-lock.json
├── start-client-preview.cmd
└── vite.config.js

Generated and never tracked:
├── dist/                        Vite production output
└── node_modules/                Local npm dependencies
```

Add folders only when required. Typical optional folders include `src/components/`, `src/pages/`, `src/hooks/`, `src/services/`, `src/assets/`, database migrations, tests, and uploads.

Do not put reusable PHP code in `dist/`. Do not put secrets in React source, `index.html`, `dist/`, or any `VITE_*` variable.

## 4. Execution model

### Daily local development

1. Start Apache and MySQL in XAMPP.
2. Run `npm run dev` from the repository root.
3. Open the Vite URL recorded in `PROJECT_PROFILE.md`.
4. Vite proxies `/api/*` to this project's XAMPP path.
5. PHP accesses local MariaDB/MySQL through `includes/database.php` and the untracked `.env`.

Do not browse the raw `index.html` through the XAMPP project URL for React development. Use the Vite development URL so modules and hot reload work correctly.

### Production build

Run:

```powershell
npm ci
npm run build
```

The deployable frontend is the contents of `dist/`. Z.com does not need Node.js, npm, Vite, `src/`, or `node_modules/`.

### Client preview

`start-client-preview.cmd` must:

1. Build the frontend.
2. Serve only `dist/` and allowed PHP API endpoints.
3. Perform a local health check.
4. Start a temporary Cloudflare URL.
5. Stop the local preview process when the tunnel ends.

The preview must not expose `.env`, phpMyAdmin, `.git`, Markdown rules, `src/`, database backups, or the full XAMPP document root.

## 5. React and Vite rules

- Keep application code in `src/` and divide it into focused components as it grows.
- Use ES modules and normal imports; do not reintroduce browser-side Babel or CDN React builds.
- Keep `package-lock.json` tracked and use `npm ci` for clean/release installations.
- Use `npm install` only when intentionally changing dependencies.
- Treat every `VITE_*` value as public because it is embedded in browser JavaScript.
- Keep API requests same-origin using paths such as `/api/...` unless a documented deployment requires otherwise.
- Keep `vite.config.js` aligned with the local XAMPP folder and intended Z.com deployment path.
- If deploying below a subdirectory rather than the domain root, update both Vite's `base` and the API base path, then test the built output at that exact path.
- Do not manually edit generated files in `dist/`; change source and rebuild.

## 6. PHP API rules

Each endpoint must:

- Accept only intended HTTP methods.
- Return an appropriate status code and consistent JSON shape.
- Validate content type and decode JSON safely when JSON is expected.
- Validate all user-controlled values server-side.
- Authenticate and authorize protected operations server-side.
- Apply CSRF protection to cookie-authenticated state-changing requests.
- Use shared database/configuration helpers rather than duplicate connections.
- Use prepared statements for all variable SQL values.
- Avoid returning stack traces, SQL, filesystem paths, or credentials.

Frontend validation is for user experience; it never replaces PHP validation.

## 7. Database rules

- Use a dedicated application database and least-privilege application user.
- Keep local, preview, and production credentials distinct. The Cloudflare preview intentionally uses the local development database.
- Never connect browser-side JavaScript directly to MariaDB/MySQL.
- Use migrations or versioned SQL for schema changes once schema development begins.
- Back up before destructive or difficult-to-reverse operations.
- Verify row counts, constraints, and affected behavior after migrations.
- Do not use the MariaDB/MySQL root account from application code.
- phpMyAdmin may be used to administer/import/export databases, but it must not be publicly tunneled.

Production changes must be prepared and tested locally first. Never point local or Cloudflare-preview code at the production database unless the user explicitly requests a controlled production operation and its risk is understood.

## 8. Environment configuration

- `.env` contains local secrets and is never committed.
- `.env.example` contains every required variable with safe placeholders and no live values.
- Production uses separate Z.com credentials.
- Prefer environment configuration outside `public_html` when Z.com supports it. If a protected file must exist under the web root, deny direct web access and verify the denial after deployment.
- Environment values already supplied by the server take precedence over `.env` values.
- Update `.env.example`, documentation, and validation whenever a required variable changes.

## 9. Dependencies

- Add only dependencies required by the current feature.
- Use maintained packages compatible with the installed Node and PHP versions.
- Review lockfile changes and run the build after dependency updates.
- Run `npm audit` where network access permits and evaluate findings rather than blindly applying breaking upgrades.
- Do not replace the stack or introduce another build system without a concrete requirement.

## 10. Git workflow

- Inspect `git status` before and after work.
- Preserve unrelated user changes.
- Never track `.env`, `node_modules/`, `dist/`, database dumps containing data, logs, or credentials.
- Do not commit, push, create branches, or modify remotes unless explicitly requested.
- Keep commits focused when the user authorizes them.
- A successful local build is required before a release commit.

## 11. Z.com deployment

Z.com receives compiled frontend files and PHP backend files, not the development toolchain.

Deployable content normally includes:

```text
contents of dist/
api/
includes/
.htaccess
production-safe public assets/uploads as applicable
```

Do not upload `src/`, `node_modules/`, local `.env`, development scripts, Git metadata, local database backups, or internal rule files into `public_html`.

The initial deployment and every later release must follow `DEPLOYMENT_WORKFLOW.md`. Deployment is not complete until HTTPS, frontend assets, PHP APIs, database access, access controls, protected files, and critical user flows are verified on the live domain.

## 12. Post-deployment changes

For each production update:

1. Back up affected production data when appropriate.
2. Implement and test locally.
3. Run PHP syntax checks, frontend build, and relevant functional/security tests.
4. Review the final diff and lockfile.
5. Commit/push only when authorized.
6. Build from the intended commit.
7. Deploy the minimum required files.
8. Apply backward-compatible database migrations in a safe order.
9. Smoke-test production over HTTPS.
10. Roll back application files if critical verification fails; restore data only through a deliberate recovery plan.

Do not edit generated production JavaScript directly. Fix `src/`, rebuild, and redeploy.

## 13. Offline functionality

Offline support is opt-in. Service Workers, Cache API, IndexedDB queues, background synchronization, and reconnect synchronization require explicit user approval before implementation.

If offline behavior is relevant:

1. Explain the intended cached/queued data and affected files.
2. Explain authentication, privacy, replay, duplicate, and stale-data risks.
3. Stop and obtain explicit approval.
4. Revalidate queued data and authorization on the server when implemented.

Never cache authenticated HTML, private API responses, secrets, or sensitive customer data indiscriminately.

## 14. UI and responsive changes

- Preserve application behavior while changing presentation.
- Prefer CSS for responsive fixes.
- Do not change PHP, API behavior, database operations, permissions, validation, event handling, or application state solely to make a layout fit.
- Preserve DOM IDs, names, classes, data attributes, and selectors used by JavaScript or tests.
- Test relevant mobile, tablet, and desktop widths.
- Avoid global overflow masking that hides layout bugs.
- Honor reduced-motion and accessibility requirements.

## 15. Testing baseline

Use the checks applicable to the change:

### Frontend

- `npm run build`
- Relevant interaction and browser-console checks
- Responsive and accessibility checks for UI changes

### PHP/API

- `C:\xampp\php\php.exe -l <file>` for every changed PHP file
- Expected method, valid input, invalid input, authentication, authorization, and safe-error cases

### Database

- Connection through the application user
- Expected reads/writes and prepared statements
- Migration verification and backup/recovery considerations

### Preview

- Built homepage and hashed assets return success
- `/api` reaches PHP and the intended local database
- `.env`, phpMyAdmin, source, and repository files are inaccessible
- Test tunnel is stopped after verification

### Release

- `git diff --check`
- Review every changed hunk
- Verify no secret or generated directory became tracked
- Production smoke test after deployment

## 16. Duplication rule

This repository is designed to be copied as a starter. A copied project is not ready until `TEMPLATE_CHECKLIST.md` is complete.

Never copy:

- `.git/`
- `.env`
- `node_modules/`
- `dist/`
- logs, uploaded private data, or database dumps
- database users/passwords or tunnel credentials

Create a new database, new least-privilege user, new `.env`, new Git repository/remote, and updated project identity for every copied project.

## 17. Completion standard

A task is complete only when the requested behavior works, applicable security controls are present, relevant checks pass, no unrelated behavior was changed, documentation remains accurate, and unverified limitations are reported plainly.
