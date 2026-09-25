# Resort analytics

Analytics is a separate authenticated admin section. It reports requests by creation
date, accepted stays and party sizes by check-in date, and cash by transaction date.
Filters apply to whole bookings, including room combinations. Currency is PHP;
calendar boundaries use Asia/Manila. The default includes the current month through
today and the preceding eleven calendar months. All history ends today; current-year
and custom ranges can include future reservations.

## Local setup

Use the database maintenance account to import
`database/migrations/016_resort_analytics.sql` into the local `odidepse_db`.
It is additive, repeatable and compatible with the existing local migration-013
finance fields. Migration 013 itself is not required for this implementation.
Do not grant ALTER/CREATE to the application user solely for setup.

Then run:

```powershell
C:\xampp\php\php.exe scripts/operations/setup-analytics.php --backfill-only
```

With a maintenance connection supplied through process-level DB environment
variables, `--apply` performs both migration and backfill. No `.env` edit is needed.
On a local XAMPP installation with its standard passwordless MariaDB maintenance
account, `--apply --local-maintenance` uses that account solely for this command;
the running application continues to use `odidepse_app`.
The command is restricted to this local project database, creates a recovery SQL
backup in a randomly named system temporary directory outside the web root, and
checks that booking row counts are preserved. Keep its printed backup path private.
Backfill sets only previously uncaptured room estimates and unknown sources, and
rebuilds activity links from recorded selections; existing agreed totals and ledger
entries are preserved. Missing rates stay unknown. Historical catalog estimates
are approximations, not historical agreed charges.

## Using the report and finance

Open Bookings → View → Finance. If no price is agreed yet, confirm the booking price;
the saved room estimate is an editable starting amount. An ordinary first price
confirmation receives a standard audit reason automatically. A complimentary (zero)
price and later price changes require a staff explanation. The main payment form
then starts with the remaining balance; staff must change it for a partial payment
and record only money actually received. Use Edit on the agreed-total card to
revise the price; a separate refund action appears when money has been collected.
Payments above the remaining balance and refunds above net
collections are rejected with the maximum allowed amount shown. Incorrect entries
are voided with a reason and retained in transaction history.
Concurrent changes return a conflict; use Reload ledger and review before retrying.
Finance changes do not send booking emails or change reservation status.

Booking History shows the remaining amount from the agreed price, or the saved
room estimate if no price was agreed, less non-void net payments. Its **With balance**
filter finds positive amounts; unknown prices are shown as such, not as paid.
Estimated amounts are labeled, and balances on cancelled or no-show bookings are
marked for review rather than treated as confirmed debts. The history export includes
the balance and its price basis.

The estimate is a one-time room-only snapshot. Catalog changes and later room/date
edits do not silently rewrite it. Review the agreed total after those edits.
Confirmed reservations past their check-in date use the existing derived no-show
status and are excluded from accepted-stay value until corrected in Bookings.
Cancelled booking transactions still count toward cash, subject to the status filter.

Outstanding means current effective total less nonvoid net payments through the
report end (capped at today), for accepted check-ins within the selected dates.
It is not a historical balance sheet. Guest counts are party visits, not unique
people. Activity demand counts one request per selected activity; associated guests
are party size, not participants. Both website and Messenger save the same reporting
metadata. Client-supplied prices or source labels are never accepted.

CSV contains active filters and monthly financial rows. Print / PDF uses the
browser print dialog and includes the applied filter context. No external reporting
service, AI provider or chart library is used. Expenses and profit are not tracked.
Each overview KPI card opens a booking breakdown modal showing the source booking,
guest, status, relevant date, amount or count, and price basis. Booking references
open the existing booking details. Net cash lists individual payments and refunds;
average booking value lists its priced-booking numerator, while cancellation rate
lists every request in its denominator and marks cancelled requests. The breakdown
uses the same report filters and is available only to an authenticated admin.

For visual testing, **Generate mock** creates an illustrative report in the browser
from the current filtered report periods and the stay/activity catalog names returned
by the authenticated analytics API. **Regenerate mock** makes another sample;
**Show live data** restores the unchanged live report. No mock bookings, payments, or
catalog entries are saved. The page displays a mock warning and disables CSV and
Print / PDF while sample figures are shown, so sample financials cannot be exported
as a live report.
Mock KPI modals show browser-only sample bookings and transactions whose row values
add up to the displayed mock figures. Sample references are not links to real
bookings and the modal clearly labels them as illustrative.

## Verification

```powershell
C:\xampp\php\php.exe scripts/local/test-analytics.php
C:\xampp\php\php.exe scripts/local/test-analytics-database.php
node scripts/local/test-analytics-export.mjs
node scripts/local/test-analytics-mock.mjs
```

The database test runs in a transaction and rolls back its fixture rows and price
change. Existing admin and catalog entries are required. Run the existing targeted
website-chat and Facebook tests when changing shared booking capture.

Endpoints: authenticated GET `/api/admin/analytics.php` accepts `preset`, `from`,
`to`, `group` (month/year), `status`, `source`, `stay_id` and `activity_id`.
Authenticated GET `/api/admin/analytics-detail.php` accepts the same filters plus
`metric` and `page`, returning up to 25 booking or transaction rows per page.
Authenticated GET/POST `/api/admin/booking-finance.php` reads one booking or applies
`set_total`, `record`, or `void`. Writes require the existing CSRF token and finance
revision. Summary reports exclude guest names/contact information; the admin-only
detail response includes guest names but not contact information. Requests are bounded to
50,000 relevant bookings; excessive requests receive a narrower-range instruction.

## Release and rollback

No production release is performed by local setup. Before an authorized release,
follow `DEPLOYMENT_WORKFLOW.md`, back up the target database, apply migration 016
with a maintenance account, and perform a reviewed backfill using the shared capture
logic. The supplied setup command intentionally refuses production databases.
Deploy the report, finance, shared booking capture and frontend changes together.
Do not deploy local tests. Restore previous application files to roll back; retain
additive columns and ledger data. Never discard financial history as a rollback.
