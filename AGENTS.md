# Codex Project Instructions

## Authority and required reading

These instructions apply to every Codex conversation and task in this repository.

Before changing project files, read:

1. `PROJECT_RULES.md`
2. `SECURITY_RULES.md`
3. `PROJECT_PROFILE.md`

Also read `DEPLOYMENT_WORKFLOW.md` before changing preview, build, hosting, environment, or deployment behavior. Read `TEMPLATE_CHECKLIST.md` before cloning this starter for another project.

`SKILL.md` is an optional visual-design specification. Read and apply it only when the user requests that design language or when the current UI is already governed by it. It does not override the architecture or security rules.

Priority order:

```text
User's current request
        +
AGENTS.md
        +
PROJECT_RULES.md
        +
SECURITY_RULES.md
        +
PROJECT_PROFILE.md
        ↓
Secure, minimal, verified implementation
```

If a request conflicts with `SECURITY_RULES.md`, do not implement the insecure portion. Explain the conflict and use the safest alternative that preserves the intended outcome.

## Canonical architecture

Preserve this architecture unless the user explicitly approves a change:

```text
React source (`src/`)
        ↓ Vite
Development: Vite on 127.0.0.1:5173
        ↓ `/api` proxy
XAMPP Apache + PHP
        ↓ PDO
XAMPP MariaDB/MySQL (managed with phpMyAdmin)

Client preview:
Vite production build (`dist/`)
        + PHP `/api`
        ↓ restricted local preview router
Cloudflare Quick Tunnel

Production:
Vite `dist/` contents + PHP backend
        ↓
Z.com cPanel hosting + production MySQL
```

Important distinctions:

- Vite and Node.js are local build tools. They do not run on Z.com.
- React runs in the browser from Vite-generated files.
- PHP is the only layer that may access the database.
- phpMyAdmin manages MariaDB/MySQL; it is not the database itself and must never be exposed through the tunnel.
- Cloudflare is for temporary client previews, not production hosting.
- Docker and Render are not part of this architecture. Do not add them unless the user explicitly changes the hosting strategy.

## Frontend file organization

Organize React source by page first and then by feature. Preserve this structure when adding, moving, or editing frontend files:

```text
src/
|-- main.jsx                         Application entry point
|-- assets/                          Images and videos used across pages
|-- pages/
|   |-- index/
|   |   |-- IndexPage.jsx            Public resort page composition
|   |   |-- features/
|   |   |   |-- chatbot/             Website booking chatbot
|   |   |   |-- gallery/             Resort and guest galleries
|   |   |   |-- stays/               Public stay cards
|   |   |   `-- weather/             Forecast and booking weather UI
|   |   `-- styles/                  Public-page styles
|   `-- admin/
|       |-- AdminPage.jsx             Admin page composition and session shell
|       `-- features/
|           |-- bookings/             Booking views, calendar, and planning
|           |-- dashboard/            Operations dashboard calculations
|           |-- facebook-automation/  Messenger, comments, and automation UI
|           `-- resort-management/    Stay, service, and content management
`-- shared/
    |-- resort/                        Resort context, formatting, and asset map
    |-- stay-photos/                   Photo UI shared by public and admin pages
    `-- styles/                        Application-wide foundation styles
```

Apply these placement rules:

- Put code used only by the public page under `src/pages/index/` in the closest matching feature folder.
- Put code used only by the admin page under `src/pages/admin/` in the closest matching feature folder.
- Put code in `src/shared/` only when both the public and admin pages use it. Do not place page-specific code there for convenience.
- Keep components beside their feature-specific styles, hooks, utilities, and tests when applicable.
- Add a clearly named feature folder when no existing feature matches; do not add feature files directly to `src/`.
- Keep `IndexPage.jsx` and `AdminPage.jsx` focused on page composition, routing, and top-level coordination. Move substantial feature behavior into its feature folder as it grows.
- Keep shared static media in `src/assets/`. Continue to keep public PHP endpoints in `api/` and reusable server code in `includes/`; the frontend page structure does not change PHP endpoint URLs.
- Before moving an existing shared module into a page folder, confirm that the other page does not import or depend on it.

## Backend file organization

Keep public PHP URLs in `api/` and organize reusable PHP implementation under `includes/` by responsibility:

```text
includes/
|-- shared/                           Cross-feature infrastructure
|   |-- api.php                       JSON, method, body, and input helpers
|   |-- auth.php                      Admin sessions and CSRF protection
|   |-- database.php                  Shared PDO connection
|   `-- environment.php               Environment-variable loading
|-- bookings/
|   `-- booking-rooms.php             Room allocation and overlap logic
|-- resort/
|   |-- resort.php                    Resort content validation and persistence
|   |-- resort-seed.json              Default resort content
|   `-- stay-photos.php               Stay-photo validation and delivery paths
|-- automations/
|   |-- facebook-automations.php      Shared rule-based booking conversation engine
|   |-- facebook-worker.php           Facebook delivery worker implementation
|   `-- website-chat.php              Website-chat adapter and session flow
`-- weather/
    `-- weather.php                   Forecast retrieval and summarization
```

Apply these backend placement rules:

- Keep files in `api/` as thin public HTTP controllers: validate the request, call reusable logic, and return a response.
- Put reusable, feature-specific business logic in the matching `includes/<feature>/` folder.
- Put a module in `includes/shared/` only when it provides cross-feature infrastructure. Do not use `shared/` as a miscellaneous folder.
- Keep browser-facing endpoint paths stable when reorganizing implementation files; moving an include must not silently change an `/api/...` URL.
- Update every PHP include path, script, test, cron command, and documentation reference when moving a backend module.
- Resolve filesystem paths from the project root deliberately after moves. Preserve the root `.env`, `src/assets/`, and existing `includes/stay-photo-storage/` locations.
- Keep the website chatbot and Facebook Messenger booking rules together under `includes/automations/` so their behavior does not drift.
- Add a clearly named feature folder when a new backend responsibility does not fit an existing one.

## Task workflow

For every task:

1. Understand the current request and inspect the relevant implementation.
2. Check the working tree and preserve unrelated user changes.
3. Identify frontend, PHP/API, database, security, preview, build, and deployment impact.
4. Make the smallest complete change.
5. Keep React source in `src/`, public PHP endpoints in `api/`, and reusable server code in `includes/`.
6. Apply server-side validation, authorization, prepared statements, and safe error handling where applicable.
7. Update documentation when commands, structure, environment variables, or deployment behavior change.
8. Verify in proportion to risk and report only tests actually run.

Do not add offline functionality, commit/push changes, deploy, modify production, or perform destructive database operations without explicit authorization.

## Shared chatbot behavior

The public website chatbot and Facebook Messenger automation share one deterministic, rule-based booking system. Treat changes to classification, parsing, validation, availability, guided replies, templates, and booking summaries as cross-channel changes unless the user explicitly limits the request to one channel.

- Implement shared behavior in `includes/automations/facebook-automations.php` or another reusable server module instead of maintaining separate copies.
- Apply every rule-based fix requested for either chatbot to both the website and Facebook paths automatically.
- Preserve only necessary channel differences: Messenger may use Facebook profile identity and can create a pending request after confirmation; website chat requires its booking-form fields and opens the prefilled booking modal after confirmation.
- After a shared behavior change, run targeted coverage for both `scripts/test-facebook.php` and `scripts/test-website-chat.php` so the channels do not drift.
- Clearly report any intentional difference between the two channels rather than silently implementing divergent behavior.

## SEO workflow

Complete and stabilize the public system, content, routes, business details, and production domain before performing the final SEO optimization pass. SEO must nevertheless be completed and verified before the production launch.

While developing:

- Preserve semantic HTML, a logical heading hierarchy, descriptive image alternative text, and clean stable public URLs.
- Compress and appropriately size new images before adding them.
- Keep indexable public content accessible without authentication.
- Keep administrative and other private routes separate from public pages and mark them `noindex`.
- Maintain consistent placeholders for the final business name, address, phone number, official social profiles, and production domain until verified values are available.

When the public system is stable, perform a dedicated SEO pass covering crawlable or pre-rendered public content, unique page titles and descriptions, canonical URLs, social-sharing metadata, structured data, `robots.txt`, XML sitemap, genuine 404 responses, image optimization, mobile performance, and Core Web Vitals. Verify production-domain behavior before considering SEO complete.

## Required verification

### Usage-conscious verification

Keep verification deliberately lean to conserve the user's Codex usage:

- Run only the smallest checks needed for the files changed, normally once near the end of the task.
- Do not repeat successful builds, syntax checks, API calls, or repository inspections unless a later change can affect their result.
- Do not perform exhaustive acceptance testing, responsive screenshot matrices, prolonged browser automation, temporary database/server setup, or broad security test suites unless the user explicitly requests them.
- Prefer one targeted reproduction and one targeted confirmation when diagnosing a bug.
- For documentation-only or similarly low-risk edits, use only a focused diff/status check when appropriate.
- Let the user perform exploratory and full functional testing by default. Clearly report what remains untested.
- If additional testing is genuinely necessary to prevent a security or data-loss risk, explain why briefly and perform the narrowest applicable check.

Run applicable checks after changes:

```powershell
npm run build
C:\xampp\php\php.exe -l path\to\changed-file.php
git diff --check
git status --short
```

For frontend-to-backend changes, verify the Vite `/api` proxy. For preview changes, verify the generated Cloudflare route blocks `.env`, phpMyAdmin, repository files, and source files. For database changes, compare schema and data before destructive actions and retain a recoverable backup when practical.

Never claim a browser, API, database, build, tunnel, or deployment test passed unless it was actually exercised.

## Git and deployment authority

Unless the user explicitly asks:

- Do not commit or push.
- Do not create or change branches or remotes.
- Do not start a public tunnel except for a bounded verification, and stop test tunnels afterward.
- Do not upload to or alter Z.com.
- Do not copy local `.env` credentials to production.

Follow `DEPLOYMENT_WORKFLOW.md` for initial releases, routine releases, rollbacks, database migrations, and post-deployment changes.
