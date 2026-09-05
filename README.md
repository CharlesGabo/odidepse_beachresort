# Odidepse Beach Resort

Reusable Vite/React + PHP/MySQL project starter for XAMPP development, Cloudflare client previews, and Z.com production hosting.

## Start development

1. Start Apache and MySQL in XAMPP.
2. Install dependencies once with `npm install`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:5173/`.

The React frontend is served by Vite. Requests to `/api` are proxied to PHP on XAMPP. PHP connects to the local `odidepse_db` database using the ignored `.env` file.

## Booking management setup

The public website accepts booking requests and saves them to MySQL. The private dashboard is intentionally not linked from the public website and is available directly at `http://127.0.0.1:5173/admin`. Access is enforced by PHP authentication, not by URL obscurity.

1. Import `database/migrations/001_booking_management.sql` into `odidepse_db` using phpMyAdmin or the MySQL client.
2. Create the first administrator from the project root:

```powershell
C:\xampp\php\php.exe scripts\create-admin.php admin@example.com "Resort Manager"
```

3. Save the generated password in a password manager. It is printed only once.
4. Start Apache, MySQL, and Vite, then open `/admin` and sign in.

Booking requests are inquiries only. The website does not take payment or promise availability; an administrator confirms each stay from the dashboard.

## Resort photos, guest stories, and weather

Original room/pool photos belong in `src/assets/photos/rooms/`; guest moments belong in `src/assets/photos/customers/`. `src/resortPhotos.js` curates which originals appear, their order, and descriptive captions. Add an entry there after adding a photo, then rebuild. Some originals are duplicated across folders; the gallery deliberately selects room/pool images separately without moving or deleting originals. The gallery supports pointer tilt, a reduced-motion layout, and a keyboard-accessible photo viewer (Escape to close, arrow keys to navigate).

`src/ResortGallery.jsx` also contains the sample feedback. Names, ratings, and text are fictional and visibly labeled; guest photos are shown separately and are not attributed to these fictional reviewers. There is no public review submission or database storage yet.

`GET /api/weather.php` retrieves MET Norway's Locationforecast for the approximate location already used by the resort map (15.0578, 120.0567). No API key is required. PHP needs cURL with working TLS certificates and a writable system temporary directory. A single application-specific file in that directory caches the upstream response and coordinates concurrent requests; provider expiry and Last-Modified headers are respected, with a minimum ten-minute refresh interval and a one-minute failure backoff. This is server-side request caching, not browser offline support. The browser refreshes while active, shows unavailable states on failure, and never substitutes mock weather.

The seven days use Asia/Manila dates. Temperatures are min/max of available forecast samples, rainfall sums non-overlapping forecast intervals assigned to their starting local day, wind is the maximum sampled speed, and the daily icon represents the interval nearest local noon. These are approximate daily summaries; today can cover only part of the day. Current conditions are the nearest model forecast, not a weather station observation. Selecting a future day pre-fills the existing booking inquiry's check-in date; normal server validation still applies.

Data attribution and the CC BY 4.0 license are linked in the weather section. Before launch, include the final public resort domain/contact in the identifying User-Agent in `includes/weather.php`; the current identifier is `OdidepseBeachResort/1.0`. See [MET Norway API terms](https://api.met.no/doc/TermsOfService) and [data license](https://api.met.no/doc/License).

## Share a client preview

Double-click `start-client-preview.cmd`. It builds the React frontend, exposes only the compiled site and approved PHP APIs, checks the database connection, and prints a temporary Cloudflare URL.

Keep the window and XAMPP MySQL running. Press `Ctrl+C` to stop sharing.

## Build for production

```powershell
npm ci
npm run build
```

Deploy the contents of `dist/` with `api/`, `includes/`, and production Apache/environment configuration. Node.js and Vite do not run on Z.com.

## Documentation map

- `AGENTS.md` — instructions Codex must follow in every conversation
- `PROJECT_RULES.md` — architecture and development invariants
- `SECURITY_RULES.md` — mandatory security controls
- `PROJECT_PROFILE.md` — project-specific names, paths, and environment assumptions
- `DEPLOYMENT_WORKFLOW.md` — local, preview, initial deployment, update, and rollback runbook
- `TEMPLATE_CHECKLIST.md` — required steps when duplicating this starter
- `SKILL.md` — optional visual design language

Complete `TEMPLATE_CHECKLIST.md` before using a copy for another project. Never copy `.git`, `.env`, `node_modules`, `dist`, private uploads, logs, or database backups.
