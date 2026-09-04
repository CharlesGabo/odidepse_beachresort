# Odidepse Beach Resort

Reusable Vite/React + PHP/MySQL project starter for XAMPP development, Cloudflare client previews, and Z.com production hosting.

## Start development

1. Start Apache and MySQL in XAMPP.
2. Install dependencies once with `npm install`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:5173/`.

The React frontend is served by Vite. Requests to `/api` are proxied to PHP on XAMPP. PHP connects to the local `odidepse_db` database using the ignored `.env` file.

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
