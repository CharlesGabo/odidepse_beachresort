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

## Required verification

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
