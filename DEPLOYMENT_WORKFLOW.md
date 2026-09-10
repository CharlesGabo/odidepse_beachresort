# Development, Preview, and Deployment Workflow

This is the operational runbook for the architecture defined in `PROJECT_RULES.md`. Values specific to this repository are recorded in `PROJECT_PROFILE.md`.

## 1. One-time local setup

Prerequisites:

- XAMPP with Apache, PHP, MariaDB/MySQL, and phpMyAdmin
- Node.js and npm compatible with the locked Vite version
- Cloudflare `cloudflared` for client previews
- Git

Setup:

```powershell
Copy-Item .env.example .env
npm install
npm run build
```

Then create the local database and a dedicated application user. Put only that user's credentials in `.env`. Do not use the database root account from PHP.

## 2. Daily development

1. Start Apache and MySQL in XAMPP.
2. Open a terminal in the repository root.
3. Run:

```powershell
npm run dev
```

4. Open `http://127.0.0.1:5173/`.

Vite serves React and proxies `/api/*` to the XAMPP project path configured in `vite.config.js`. PHP connects to the local database through `.env`.

If an API request fails:

1. Confirm XAMPP Apache and MySQL are running.
2. Open the PHP API directly at the XAMPP project URL.
3. Confirm `.env` values and `pdo_mysql` availability.
4. Confirm the Vite proxy rewrite matches the XAMPP folder.
5. Check private PHP/Apache logs without exposing details to the browser.

## 3. Client preview with Cloudflare

Double-click `start-client-preview.cmd`.

The launcher:

1. Runs `npm run build`.
2. Serves `dist/` on a project-only local server.
3. Routes `/api/*.php` to the project's PHP endpoints.
4. Confirms PHP and the database respond.
5. Creates a temporary `trycloudflare.com` URL.
6. Waits for Cloudflare DNS publication and verifies the public PHP health endpoint before displaying the URL.

Send the displayed HTTPS URL to the client and keep the window, computer, internet connection, and XAMPP MySQL running. Press `Ctrl+C` to stop sharing.

Quick Tunnel URLs are random and change after restart. Use preview/test data only. Do not expose production data or treat this tunnel as production hosting.

Do not copy a URL from Cloudflare startup output or open it before the launcher reports that the client preview is publicly reachable. An early lookup can cache a temporary `NXDOMAIN` response. If Cloudflare creates a URL but does not publish its DNS record, the launcher stops with a service-error message; wait a few minutes and run it again.

After preview-script changes, verify publicly that:

- `/` and built assets return `200`.
- `/api/hello.php` returns the expected safe response.
- `/.env`, `/phpmyadmin/`, `/src/`, `/.git/`, and rule files return `404` or `403`.

## 4. Pre-release gate

Before every Z.com release:

1. Confirm the intended commit and clean/understood working tree.
2. Back up production data if the release can affect it.
3. Install exactly from the lockfile and build:

```powershell
npm ci
npm run build
```

4. Lint every changed PHP file:

```powershell
C:\xampp\php\php.exe -l path\to\file.php
```

5. Test critical flows locally, including invalid and unauthorized cases.
6. Review `git diff --check`, `git diff`, and `git status --short`.
7. Confirm `.env`, `node_modules/`, `dist/`, backups, logs, and private uploads are not tracked.
8. Confirm the production base path. The current `/api/...` calls assume deployment at the domain root.

## 5. Initial Z.com deployment

### Database

1. Create a production MySQL database in cPanel.
2. Create a new production-only database user with minimum required privileges.
3. Import the reviewed schema/data through phpMyAdmin or the approved migration process.
4. Do not reuse local credentials.

### Environment

Create production environment values separately. Prefer a file outside `public_html` and configure the application to load it. If hosting limitations require an `.env` under `public_html`, protect it with Apache rules and verify a public request cannot retrieve it.

Never upload the local `.env`.

### Files

The public application should contain:

```text
public_html/
├── index.html                  from dist/index.html
├── assets/                    from dist/assets/
├── api/                       PHP endpoints
├── includes/                  shared PHP code
└── .htaccess                  production-safe Apache rules
```

Upload the contents of `dist/`, not a nested `dist` directory.

Do not place these in `public_html`:

```text
src/
node_modules/
scripts/
.git/
local .env
package.json / package-lock.json
vite.config.js
internal Markdown rules
database backups
Cloudflare launchers
```

### Hosting configuration

- Select a supported PHP 8.x version compatible with the application.
- Enable required extensions, including PDO and `pdo_mysql`.
- Enable HTTPS and redirect HTTP to HTTPS.
- Disable public error display and enable private logging.
- Configure secure sessions, upload limits, email/SMTP, and scheduled tasks as applicable.
- Configure SPA fallback routing if client-side routes are introduced.

## 6. Production verification

Verify over the real HTTPS domain:

- Homepage and every generated asset load successfully.
- No browser console errors occur.
- PHP APIs return correct status codes and safe JSON.
- Database reads/writes use the production database.
- Authentication, authorization, CSRF, and validation work.
- `.env`, internal PHP modules, backups, directory listings, and source files are inaccessible.
- Critical desktop and mobile flows work.
- Email, uploads, and external integrations work when present.

Do not declare deployment complete while a critical check is unverified.

## 7. Updating an existing deployment

1. Back up affected data and record the currently deployed commit/build.
2. Implement and test locally.
3. Apply database changes through reviewed, versioned migrations.
4. Run the pre-release gate.
5. Deploy the new `dist/` contents and changed PHP/backend files together as one release.
6. Clear only necessary caches.
7. Run production smoke tests immediately.
8. Monitor private logs for regressions.

Never patch minified files in production as the source of truth. Make the change in `src/`, rebuild, and redeploy.

## 8. Safe migration order

Prefer backward-compatible database releases:

1. Add new nullable columns/tables/indexes.
2. Deploy code that can work with old and new schema where needed.
3. Migrate/backfill data.
4. Switch application behavior.
5. Remove obsolete schema only in a later, separately verified release.

Back up first and verify row counts/constraints. Never use phpMyAdmin's destructive actions casually on production.

## 9. Rollback

If a critical release check fails:

1. Stop further changes.
2. Preserve logs and evidence without exposing secrets.
3. Restore the last known-good frontend and PHP release.
4. Do not reverse a database migration unless a tested reversal is safe.
5. If data recovery is required, use the approved backup and document the affected interval.
6. Re-test critical flows after rollback.

## 10. End of Cloudflare-preview use

Cloudflare tooling is local-only. It is not uploaded to Z.com and does not need to be removed from the development repository after production launch. It may continue to support isolated previews, provided it never connects to production data.
