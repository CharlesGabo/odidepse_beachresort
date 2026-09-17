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

Do not deploy the entire folder automatically. When Facebook Messenger delivery is enabled, `operations/facebook-worker.php` is the only script currently required by the production recovery cron.
