# Project Profile

This file contains project-specific values used by the otherwise reusable starter. Update every value in this file and complete `TEMPLATE_CHECKLIST.md` when duplicating the repository.

## Identity

| Setting | Current value |
|---|---|
| Display name | Odidepse Beach Resort |
| Project slug | `odidepse-beach-resort` |
| XAMPP folder | `odidepse_beachresort` |
| Repository folder | `C:\xampp\htdocs\odidepse_beachresort` |

## Local services

| Service | Current value |
|---|---|
| Vite development URL | `http://127.0.0.1:5173/` |
| XAMPP project URL | `http://localhost/odidepse_beachresort/` |
| PHP API base | `http://localhost/odidepse_beachresort/api/` |
| Cloudflare preview origin | `http://127.0.0.1:8765` |
| Local database | `odidepse_db` |
| Local application DB user | `odidepse_app` at `127.0.0.1` |

Local credentials exist only in the ignored `.env`. Never add their values here.

## Production assumptions

| Setting | Current value |
|---|---|
| Host | Z.com cPanel web hosting |
| Public root | `public_html/` |
| Public application path | Domain root `/` |
| Frontend artifact | Contents of `dist/` |
| Backend directories | `api/` and `includes/` |
| Database | Separate Z.com MySQL database and user |

The production domain, cPanel home path, database name, database user, and credentials are intentionally unset until deployment.

## Configuration touchpoints

When identity or location changes, inspect and update:

- `package.json` — package name
- `index.html` — title and metadata
- `src/` — visible project name/content
- `vite.config.js` — XAMPP proxy rewrite and production base
- `.env.example` — database defaults/placeholders
- `scripts/start-client-preview.ps1` — executable paths, port, and status text
- API responses or email templates containing the project name
- database/schema names and migration files
- Git remote and hosting configuration

Search the full repository for the old display name, slug, XAMPP folder, database name, and database user before considering a rename complete.
