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
7. Runs the Facebook delivery worker every second while the preview is open, then stops it with the tunnel.
8. Runs the email worker every 30 seconds while the preview is open, then stops it with the tunnel. SMTP is disabled by default; use `MAIL_TEST_RECIPIENT` for previews.

Send the displayed HTTPS URL to the client and keep the window, computer, internet connection, and XAMPP MySQL running. Press `Ctrl+C` to stop sharing.

Quick Tunnel URLs are random and change after restart. Use preview/test data only. Do not expose production data or treat this tunnel as production hosting.

After every restart, copy the exact Meta Page webhook callback URL printed by the launcher into the Meta app and complete **Verify and save**. The launcher resets the previous verification indicator because the old Quick Tunnel address is no longer current.

Do not copy a URL from Cloudflare startup output or open it before the launcher reports that the client preview is publicly reachable. An early lookup can cache a temporary `NXDOMAIN` response. If Cloudflare creates a URL but does not publish its DNS record, the launcher stops with a service-error message; wait a few minutes and run it again.

After preview-script changes, verify publicly that:

- `/` and built assets return `200`.
- `/api/hello.php` returns the expected safe response.
- `/.env`, `/phpmyadmin/`, `/src/`, `/.git/`, and rule files return `404` or `403`.

## 4. Pre-release gate

### Release branch while analytics is in development

Deploy from `main`. The `analytics` branch contains the unfinished analytics page,
forecasting, AI insights, mock data, booking-finance additions and source tracking.
Keep that branch separate until those features are approved for release.

Before preparing release files, save and commit any development work on its branch,
then switch to `main` with a clean working tree:

```powershell
git status --short
git switch main
git branch --show-current
npm.cmd run build
```

Switching branches does not replace ignored `dist/` output. Always rebuild after
switching, and take both the frontend build and PHP backend from the same branch.
Do not upload leftover or untracked feature files. Follow the full pre-release
gate below before an actual release; a build alone is not release approval.

Use the schema and reviewed migrations from `main` for production. Migration
`013_admin_analytics.sql` belongs to the analytics branch and is excluded from this
release. Do not import the entire analytics development database into production.
The local database may retain migration 013: switching Git branches does not switch
or roll back the database. Keep production on its separate database and credentials.

To resume analytics development, save release work first and run `git switch analytics`.
Rebuild again before using a compiled preview. Merge approved main-system fixes into
analytics as needed; merge analytics into main only when that feature is ready.

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
├── scripts/operations/        only explicitly required production workers
└── .htaccess                  production-safe Apache rules
```

Upload the contents of `dist/`, not a nested `dist` directory.

Do not place these in `public_html`:

```text
src/
node_modules/
scripts/local/
scripts/operations/ files other than an explicitly required worker
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
- Deploy `scripts/operations/facebook-worker.php` when Messenger delivery is enabled and `scripts/operations/email-worker.php` when email is enabled. Do not deploy other scripts by default.
- Configure a once-per-minute recovery cron for `php /home/ACCOUNT/public_html/scripts/operations/facebook-worker.php` after replacing the placeholder with the real cPanel home path. Messenger webhooks attempt immediate event-scoped delivery; this cron remains required for retries and interrupted requests.
- Configure SPA fallback routing if client-side routes are introduced.

### Email notifications

Follow `scripts/local/email-notifications.md` for Gmail app-password setup and
local verification. Apply additive migration `014_email_notifications.sql`
before deploying the email-enabled PHP code. Migration 013 remains unrelated.
The runtime database user does not need CREATE permission; apply migrations using
the controlled phpMyAdmin maintenance account.

Install locked PHP dependencies locally with Composer (`install --no-dev
--optimize-autoloader`) and upload the generated `vendor/` directory with the PHP
release. Protect it and Composer metadata using the updated `.htaccess`. Do not
upload Composer's installer/PHAR or local `.env`. PHP 8.1+, OpenSSL and mbstring
are required by this email implementation.

Also deploy `scripts/operations/email-worker.php` when email is enabled, and add
the once-per-minute cron `php /home/ACCOUNT/public_html/scripts/operations/email-worker.php`
using the hosting account's real PHP binary/path. This is an additional approved
production worker alongside `facebook-worker.php`; other operational scripts
remain excluded. Keep cron output private.

Configure SMTP credentials, From/Reply-To, `MAIL_ADMIN_RECIPIENTS` and HTTPS
`APP_BASE_URL` separately for production. Start with `MAIL_ENABLED=0`. Use a test
inbox redirect, enable sending deliberately, then run the protected admin test.
Verify actual inbox receipt and the worker heartbeat before removing the test
redirect. SMTP acceptance alone is not delivery confirmation. No migration sends
historical booking emails. Keep the worker running for daily 07:00 Asia/Manila
digests, one-day reminders, and retries. See the delivery log for failures or
uncertain outcomes; these must not be blindly resent.

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

### Stay photos

Stay photo IDs and their order are saved in `resort_stays.details.photos` (JSON); existing records without this key have no assigned photos. No schema migration is required. Admins can assign existing room assets or upload JPEG/PNG/WebP images; the browser converts uploads to JPEG, at most 1920 pixels and 2 MB. PHP requires fileinfo, validates the JPEG dimensions/content type, and accepts authenticated, CSRF-protected uploads only.

Uploaded files live in the ignored `includes/stay-photo-storage/` directory, protected by the existing denial of direct access to `includes/`. Make this directory writable by PHP on hosting. Back it up alongside the database and preserve it during releases. Deploy the new PHP endpoints along with the frontend. Photos are served through `/api/stay-photo.php`; unpublished or unassigned uploads require admin authentication. These API routes use the existing Vite proxy and restricted preview API routing.

Removing a photo from a stay removes its association when saved; the file is retained for recovery. Uploads abandoned without saving are also retained and are admin-only. No automatic filesystem deletion occurs. Verify upload, save, public display, and direct-storage denial before release.

Cloudflare tooling is local-only. It is not uploaded to Z.com and does not need to be removed from the development repository after production launch. It may continue to support isolated previews, provided it never connects to production data.
