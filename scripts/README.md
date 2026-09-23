# Script organization

Scripts are separated according to whether they are strictly local or may be used for controlled operations.

```text
scripts/
|-- local/       Preview, tests, diagnostics, test configuration, and local docs
`-- operations/  Setup, maintenance, administration, and production worker entry points
```

## Local

Everything in `local/` is development-only and must not be uploaded to production. The root `start-client-preview.cmd` launcher calls `local/start-client-preview.ps1`.

## Operations

Files in `operations/` must be run deliberately from the command line. Most are one-time setup or maintenance tools and are not public web endpoints.

Email setup is documented in `local/email-notifications.md`. The additional
production entry point `operations/email-worker.php` is required when email is
enabled. Run it once per minute through cron. `operations/setup-email.php` is
local/controlled maintenance only and is not deployed. Local email tests use a
fake transport; `local/email-worker-loop.ps1` is only for development/preview.

Do not deploy the entire folder automatically. Deploy only the required workers:
`operations/facebook-worker.php` for Messenger and `operations/email-worker.php`
for email. Both require a production recovery cron.
