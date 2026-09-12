# Facebook Automations — local workspace

The admin navigation includes **Facebook Automations** immediately below Website Content. It uses the existing admin session, CSRF protection, Vite `/api` proxy, and PHP/PDO database connection. Verified Messenger messages are categorized and their approved templates are queued automatically. Manual test entries remain blocked, and draft approval does not publish a post.

## Setup and verification

With the existing local Apache/MySQL services running:

```powershell
C:\xampp\php\php.exe scripts/setup-facebook.php
C:\xampp\php\php.exe scripts/test-facebook.php
npm run build
```

Setup checks for the additive `database/migrations/004_facebook_automations.sql` tables in the local `odidepse_db` using its configured application account, and creates missing tables only if it has schema privileges. It preserves existing rows and reports booking counts before/after. If CREATE permission is unavailable, apply the SQL through the local database administration connection (for example phpMyAdmin); do not substitute root credentials in the application. The test uses a transaction and rolls back its own rows.

For a later authorized Z.com release, apply migrations 004, 005, and 006 in order after migrations 001 and 003, then deploy the changed PHP and compiled frontend together. Keep setup/test scripts and this document out of `public_html`; follow `DEPLOYMENT_WORKFLOW.md`. Configure the documented Meta environment values separately; never upload the local `.env`.

## Available workflows

- Messenger: new webhook inquiries are classified by English/Filipino keywords and automatically queued with the matching approved reply template. Manual entries are explicitly labelled and never establish Messenger sending eligibility.
- Reply rules: save classification, automatic reply, and comment alert preferences plus category templates. Automatic replies are enabled by default. Complaints always need a person, and a blank template sends that category to staff. Updates apply to new intake, not historical items.
- Comments and staff alerts: record comments; see new-comment and complaint flags across all inquiry types in Staff alerts. Clear attention after acknowledging. Comments are private by default; an admin can publish or hide each comment on the homepage. The public API exposes only the display name, original text, and received date. Alerts are in-app and refreshed on page navigation or Refresh; no email, push, or background polling is enabled.
- Leads: record guest contact details and inquiry text. Facebook item IDs are optional but deduplicated when supplied. Open the existing booking form, review guest details, choose dates/stay, and save a pending booking. Lead linking and booking insertion share one transaction and lock the lead to prevent double conversion. Leads and public inquiries never imply a confirmed reservation; an admin must confirm a pending booking. Incomplete leads remain in the lead inbox.
- Post drafts: write a caption or generate one using a fixed introduction, supplied details, and call to action. This is template generation without an AI provider. Review, approve, reject, and edit drafts. Edits clear approval; revision checks prevent stale approvals. Publishing remains disconnected.
- Delivery queue: inspect automatic and staff-prepared replies; cancel a queued job. A cancelled reply can be prepared again, but an active/sent job is deduplicated by inquiry. Changing a category or resolving an inquiry cancels outstanding replies.
- Audit: immutable through the API, metadata-only actions with actor/entity IDs and timestamps. Inbox/draft content is held separately in protected tables. Lists are paginated in sets of 25.

## Next connection phase

Implement a verified Meta webhook adapter, then reuse/refactor the intake workflow for trusted events. Manual IDs must be reconciled with live IDs without establishing trusted message timestamps from manual records. Store only the contact/content fields the workflow needs, and define retention with the owner before live customer intake.

The public callback is `/api/facebook-webhook.php`. Configure Meta app/Page credentials server-side, HTTPS verification and webhook signature checks, correct Page identity, subscriptions and permissions, duplicate-event handling, and lead-detail retrieval. The callback rejects invalid signatures and events for other Page IDs, skips Messenger echoes, deduplicates Meta IDs, hides deleted public comments, and stores a verified last customer-message timestamp for Messenger conversations. Run `php scripts/facebook-worker.php` every minute from cron to resolve the sender's display name and deliver eligible automatic replies. If Meta does not return a name, the inbox retains the `Messenger guest` fallback. Lead events remain blocked until lead-detail retrieval is completed. The worker rechecks source, Page, conversation age, status, category, and template at dispatch; manual entries and old queued replies never become eligible just because the connection is enabled.

Add the cPanel worker after the transport is ready. Jobs require atomic claims, attempt increments, stale-claim handling, rate-limit handling, and the approved draft revision check. `facebookRetryDecision()` and `facebookRecordFailure()` provide bounded exponential backoff (up to five attempts), Retry-After handling, terminal errors, and audit recording. Unconfirmed sends require reconciliation before any retry. No worker runs in this phase and no automatic retries are claimed as operational.

External notification delivery, AI-generated captions, automatic lead conversion, and scheduled publishing are separate additions; this workspace supports staff-reviewed booking conversion and template-generated drafts.
