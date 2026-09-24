# Email notifications: setup and operation

PHPMailer sends through Gmail SMTP. The database outbox records booking events in
the same transaction as the booking, then sends after commit or through the email
worker. SMTP rejection never removes a saved booking. SMTP acceptance is not a
delivery/open receipt; bounce tracking is not supplied by Gmail SMTP.

## Local setup

1. Start XAMPP Apache and MySQL.
2. Install the locked PHP dependency using PHP 8.1+ (local XAMPP is PHP 8.2):

   ```powershell
   C:\xampp\php\php.exe -d extension=zip composer.phar install --no-dev --prefer-dist --optimize-autoloader
   ```

   Composer is a local build tool. If not installed, download its installer from
   https://getcomposer.org/download/ and verify the published SHA-384 signature.
   The `-d extension=zip` option enables XAMPP's bundled ZIP extension only for this
   invocation. Do not change system PHP configuration just for installation.
3. Import `database/migrations/014_email_notifications.sql` into `odidepse_db`
   using phpMyAdmin's SQL/Import screen. The runtime database account deliberately
   need not have CREATE privileges. If the chosen maintenance account does have
   CREATE, `php scripts/operations/setup-email.php` applies the same additive SQL.
   Migration 013 is unrelated analytics work and is not required.
   Until all three email tables exist, booking operations keep working and report
   email setup required; events during that interval are not backfilled.
4. Add the email keys from `.env.example` to the ignored local `.env`. Do not
   overwrite existing database or Meta credentials. Never share the app password
   in chat or commit it.
5. In the sending Google account, enable 2-Step Verification and create a dedicated
   app password at https://myaccount.google.com/apppasswords. Use that password for
   `MAIL_PASSWORD`, never the Google sign-in password. Some managed accounts and
   Advanced Protection accounts disallow app passwords; they require a different
   provider or separately configured OAuth support.
6. Set host `smtp.gmail.com`, port `587`, encryption `tls`. Set `MAIL_USERNAME`
   and `MAIL_FROM_ADDRESS` to the same Gmail address. `MAIL_FROM_NAME` can be
   `Odidepse Beach Resort`; set Reply-To to the monitored resort inbox. Supply
   one or more comma-separated `MAIL_ADMIN_RECIPIENTS` (maximum ten).
7. Set `APP_BASE_URL` to the intended HTTPS site URL. It is used only for admin
   links; the current preview URL changes after a tunnel restart, so update this
   setting when testing links through a preview. No URL is inferred from Host headers.
8. During testing set `MAIL_TEST_RECIPIENT` to your own inbox. This redirects every
   recipient, including customers, to that inbox. Set `MAIL_ENABLED=1` only when
   ready to send. Open Admin → Email notifications → Send test to admin inboxes.
   Tests are limited to one batch every ten minutes.
9. Run the email worker during normal local development:

   ```powershell
   powershell -NoProfile -File scripts/local/email-worker-loop.ps1
   ```

   It runs every second and reuses its SMTP connection for each queued batch. The client-preview launcher starts and stops its own
   email loop. On local Apache module PHP, booking requests return as soon as the
   booking and email job are safely saved; the worker sends the email separately.
   FastCGI environments may also attempt bounded delivery after closing the HTTP
   response. The once-per-minute production cron remains essential for recovery
   and scheduled messages.

10. To deliberately send an additional operations digest for testing, stop the
    loop and run:

    ```powershell
    C:\xampp\php\php.exe scripts/operations/email-worker.php --digest-now
    ```

    This manual option bypasses only the once-per-day digest deduplication. It
    does not change the normal 7:00 AM Asia/Manila schedule.

## Coverage and controls

Customer events: pending receipt, revised pending request/dates, changed
accommodation, confirmation, check-in, cancellation with reason, completion, and
one-day-before-arrival reminder. Admin events mirror booking events and add flagged
Facebook comments/complaints/handoffs, failed Facebook deliveries, and the daily
operations digest. Routine Messenger replies do not generate individual mail.

The website chat creates no booking until its form is submitted; that form queues
the email. Messenger queues when it commits its pending booking. No emails are
generated for historical status events. Manual-entry opt-out applies only to the
initial receipt, not subsequent booking changes. Missing customer email is logged
as skipped; admin alerts still queue. Admin recipients are server configuration,
not login addresses. Requests with invalid recipient configuration remain saved;
the readiness panel flags the configuration for correction.

Dates and status are taken from saved booking snapshots. Emails do not contain
mock prices, payment receipts, private guest notes, or guaranteed activity rates.
No-show is currently derived from dates, not a persisted status change, and is
included only in the admin digest. Existing status transitions are preserved:
only pending bookings can currently be cancelled.

Status actions have a confirmation summary and optional guest-facing note;
cancellations require a reason. Date edits accept a guest-facing note. Calendar
drags change the database immediately (existing behavior), but only **Save room
changes** queues a consolidated accommodation email. Undo before saving sends
nothing. Moving between numbered units of the same accommodation sends nothing;
internal unit numbers are not promised in customer emails. Finish saving before
signing out because the existing room undo history belongs to the admin session.

The optional HTTPS feedback link can later point to a Google Form or review page.
Leave it blank now: completed stays get a thank-you without a review button.

Both schedules use Asia/Manila: a reminder at/after 07:00 the day before check-in,
and one admin digest at/after 07:00 each day. A late worker catches up that day;
it does not send obsolete past-day digests or reminders. Rescheduling updates the
reminder target; customer messages with superseded dates/status/recipient are
cancelled before sending.

## Failure handling and privacy

- One worker holds a database advisory lock; competing workers exit immediately.
- Temporary failures retry after 1, 2, 4, and 8 minutes, up to five attempts.
- Permanent rejections are failed. Interrupted/uncertain SMTP delivery is marked
  unknown and never automatically retried. Staff must acknowledge duplicate risk
  before a manual retry. SMTP cannot guarantee exactly-once delivery after a crash.
- Each recipient/event has a unique key and a stable Message-ID. Successful jobs
  cannot be retried. Failed jobs allow at most three manual retry batches.
- Customer email is limited to ten new jobs per address/hour in addition to public
  booking IP limits. No arbitrary public mail endpoint exists.
- Disabling a category cancels its queued unsent jobs. MAIL_ENABLED=0 suppresses
  new events and pauses already queued jobs. Re-enabling never backfills skipped
  events. Inspect outstanding jobs before re-enabling after an outage.
- SMTP secrets and provider debug output never appear in delivery logs/API results.
- After 90 days, the worker removes personal payloads/addresses/notes from terminal
  email and booking-event records, retaining dedupe tombstones. Booking records
  themselves follow the existing booking retention policy.
- The admin banner/log is the fallback when email itself fails. An SMTP outage
  cannot reliably notify its own failure by email. The digest includes outstanding
  failures when mail works again. Check worker heartbeat and the log regularly.

## Verification commands

```powershell
C:\xampp\php\php.exe scripts/local/test-email.php
C:\xampp\php\php.exe scripts/local/test-email.php --database
C:\xampp\php\php.exe scripts/local/test-facebook.php
C:\xampp\php\php.exe scripts/local/test-website-chat.php
node scripts/local/test-email-http.mjs
npm.cmd run build
```

The email test uses a fake transport and never calls Gmail. Database tests require
the additive migration and local database; they roll back transactional fixtures
and remove only their explicitly tracked worker-test rows afterward. A real inbox
delivery check is still needed after the user configures Gmail.

## Production

Build `vendor/` locally from `composer.lock` using `--no-dev --optimize-autoloader`
and deploy it with `api/`, `includes/`, `.htaccess`, the frontend, and
`scripts/operations/email-worker.php`. Do not upload Composer's installer/PHAR,
development scripts, or local `.env`. Configure independent production secrets.

Apply migration 014 before deploying the new PHP endpoints, then configure:

```text
* * * * * /path/to/php /home/ACCOUNT/public_html/scripts/operations/email-worker.php
```

Use the actual cPanel PHP binary and account path. Keep cron output private.
Verify HTTPS denial for vendor files, Composer metadata, `.env`, includes, source,
Git, scripts, and phpMyAdmin. Keep MAIL_ENABLED=0 until production SMTP readiness
and the controlled test inbox have been verified; remove MAIL_TEST_RECIPIENT only
when customer delivery is intended. No production setup is performed automatically.
