# Reusing This Repository for Another Project

Use this checklist immediately after copying the starter. Do not begin feature development until identity, database, paths, and Git isolation are complete.

## 1. Copy only reusable files

Do not copy:

- `.git/`
- `.env`
- `node_modules/`
- `dist/`
- database dumps or backups
- logs or uploaded private/user data

Copy source, configuration templates, scripts, and Markdown guidance into a new folder under `C:\xampp\htdocs\`.

## 2. Set the new identity

Update `PROJECT_PROFILE.md` first.

Then replace the old project values in:

- `package.json`
- `index.html`
- `src/`
- `vite.config.js`
- `.env.example`
- preview-script status messages
- API/email text
- schema/migration names where applicable

Search the entire repository for the old display name, slug, XAMPP folder, database name, and database username. A rename is incomplete while any unintended old reference remains.

## 3. Create isolated local configuration

1. Copy `.env.example` to `.env`.
2. Create a new MariaDB/MySQL database.
3. Create a new least-privilege application user and a new strong password.
4. Grant access only to the new database.
5. Put the new values in `.env`.
6. Confirm `.env` is ignored by Git.

Never reuse another project's database user or secret.

## 4. Update local routing

In `vite.config.js`, update the proxy rewrite to the new XAMPP folder.

Confirm:

```text
http://localhost/<new-xampp-folder>/api/hello.php
```

If port `8765` is already used, assign a different preview port in `scripts/start-client-preview.ps1` and record it in `PROJECT_PROFILE.md`.

Update executable paths in the preview script if XAMPP, Node.js, or cloudflared is installed elsewhere.

## 5. Install and verify

Run:

```powershell
npm install
npm run build
```

Start Apache and MySQL in XAMPP, then run:

```powershell
npm run dev
```

Verify:

- React loads at `http://127.0.0.1:5173/`.
- `/api/hello.php` works through Vite.
- PHP connects with the new application user.
- The old project's database is not accessed.
- PHP syntax and frontend build checks pass.

## 6. Test the client preview

Run `start-client-preview.cmd` and verify:

- The production build is regenerated.
- The public URL serves the new project identity.
- The PHP API reaches only the new local database.
- `.env`, phpMyAdmin, `src/`, `.git`, and internal files are blocked.
- The tunnel stops cleanly with `Ctrl+C`.

## 7. Initialize version control

Create or connect a repository specifically for the new project. Confirm no old remote remains and no secret/generated/private files are staged.

Codex must not initialize, commit, push, or change a remote unless the user explicitly requests it.

## 8. Prepare future production

Record the intended production domain and path in `PROJECT_PROFILE.md`. Do not add production credentials during template setup.

Before launch, follow `DEPLOYMENT_WORKFLOW.md` and create:

- A separate Z.com production database
- A separate production database user/password
- Production environment configuration
- HTTPS and secure hosting configuration
- A tested backup and rollback plan

## 9. Template completion gate

The copied starter is ready only when:

- No unintended old project name/path remains.
- Local database isolation is verified.
- `.env` is ignored and contains no copied secret.
- `npm run build` passes.
- Relevant PHP files pass syntax checks.
- Vite proxy and Cloudflare preview work.
- `PROJECT_PROFILE.md` matches reality.
- Git remote/history are correct for the new project.
