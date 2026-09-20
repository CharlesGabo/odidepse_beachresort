# Admin analytics and finance

Open `/admin`, then **Analytics**. Filters apply after **Apply filters**; **Refresh data** reloads the current selection. Forecasts cover today through the following 89 days: daily for the first 30 and weekly thereafter. The owner-ready forecast translates the first 30 days into expected occupied room-nights, rooms already booked, likely remaining demand, focus dates and practical actions. **Generate AI insights** sends only server-selected aggregates to Gemini. There is no automatic AI call or business action.

## Generate mock data

The local **Generate mock data** button creates a separate analytics-only sample view: two years of seasonal booking history, recent growth, mixed sources/outcomes, partial/full payments, refunds, missing totals, and upcoming reservations. It resets filters to the last 90 days. Accommodation and source filters also work on the sample. **Use real data** returns to actual reports. Booking drill-through is hidden for mock records because they have no real booking IDs. Nothing is inserted into the booking, payment, status-history or availability tables; no cleanup of operational data is needed.

The feature requires server-only `ANALYTICS_MOCK_DATA_ENABLED=1`, loopback DB host, and the local `odidepse_db` name. The local environment enables it; `.env.example` defaults to disabled. Keep it disabled in production. Authenticated, CSRF-protected `POST /api/admin/analytics-mock.php` returns a fresh bounded seed. Analytics and insight endpoints accept `dataset=mock` and that seed; the server rejects mock mode when disabled. Generation is deterministic for the seed, Manila date, and catalog. Up to twenty enabled accommodation types and three units per type are sampled with non-overlapping scheduled stays. All financial amounts are fictional.

Mock reports use the real aggregation and forecasting implementation with separate cache keys. Cached aggregates expire normally; there are no guest records or durable mock booking rows. Gemini receives an explicit synthetic-data label. AI remains opt-in through its own button and uses the usual quotas.

## Database setup and release order

Migration `database/migrations/013_admin_analytics.sql` adds nullable booking totals, source attribution, finance revisions, ledger/audit/status-history tables, and aggregate caches. Apply once after migrations 001–012, before deploying this feature. The script uses standard MySQL ALTER statements and preserves existing booking rows; legacy totals remain null. Facebook event linkage and server-generated `OD-W-` references identify some historic sources; the rest remain unknown.

For local backup/setup through an account that has DDL privileges:

```powershell
C:\xampp\php\php.exe scripts/operations/setup-analytics.php
C:\xampp\php\php.exe scripts/operations/setup-analytics.php --apply
```

The setup command accepts only the local project database. It first writes a full logical SQL backup to a unique directory in the operating-system temporary directory, outside Apache's document root, and reports its path. Store that backup securely; it contains private data. It can be restored into an empty recovery database with MySQL tooling. If the application account lacks ALTER/CREATE permissions, apply the SQL through local phpMyAdmin or the MySQL administration CLI instead; do not grant DDL privileges to the runtime account merely to run this command. The runtime account needs SELECT/INSERT/UPDATE/DELETE on the new tables, consistent with its existing database privileges.

On production, follow `DEPLOYMENT_WORKFLOW.md`: separately authorize the release, retain a recoverable backup, apply migration with the database administrator, then deploy the compiled frontend and required PHP files together. Do not deploy local scripts or backups. No Python, Node runtime, cloud model hosting, cron, new package, or public tunnel is required. If rolling back application files, retain the additive schema and all financial records. Before migration, existing booking controllers tolerate the old schema; analytics/finance report setup unavailable.

## Finance behavior

Booking details contain **Finance**. Staff set the agreed PHP total and a reason before confirming a pending request. A zero total requires an explanation. Legacy confirmed bookings remain usable without a total and show a coverage gap. Public mock prices are never used as financial facts.

Amounts are decimal strings with at most two decimals, up to `9999999999.99`; all arithmetic uses integer centavos. Totals, deposits, final payments, refunds and corrections are manually recorded. Payment methods are cash, GCash, bank transfer, card or other. Refund notes and void reasons are mandatory. Transaction dates may range from 2000-01-01 through today in Manila. Online payment processing, invoices, taxes and receipts are outside this feature.

Each write locks the booking and checks `finance_revision`. Competing edits and repeated submissions with an old revision return 409; reload before retrying. Payments cannot exceed the balance, refunds cannot exceed net collections, and totals cannot fall below net collections. Voiding preserves the original transaction and records actor, timestamp and reason; dependent entries must be corrected first if voiding would create an invalid balance. Cancelled bookings allow refunds but no new payments.

## API contracts

- `GET /api/admin/analytics.php`: `preset=30|90|365|custom`, `from/to=YYYY-MM-DD` for custom, `stay_id=0|id`, `source=all|website|website_chat|facebook|manual|unknown`, `status=all|pending|confirmed|checked_in|completed|cancelled|no_show`. Up to 1096 inclusive days ending no later than today. Returns `{status, analytics}` with filters, metrics, time series, breakdowns, recorded transitions, forecast, methodology notes, generated timestamp and data hash. A 50,000-booking ceiling fails explicitly rather than truncating.
- `GET /api/admin/booking-finance.php?booking_id=id`: returns `{status, finance}` including total, balance, revision, entries and total audit.
- `POST /api/admin/booking-finance.php`: JSON `booking_id`, integer `revision`, and action. `set_total` takes decimal-string `amount` and `reason`; `record` takes `kind=payment|refund`, decimal-string `amount`, `paid_on`, `method`, optional `reference`, and `note`; `void` takes integer `entry_id` and `reason`.
- `POST /api/admin/analytics-insights.php`: JSON analytics filters; server reloads and calculates facts. Returns `{status, result}` where `available=false` is a graceful provider/configuration/validation fallback. No client-supplied statistics or prompts are accepted.

All endpoints require the existing admin session, return no-store JSON and safe errors. POST requires JSON and `X-CSRF-Token`. Existing booking responses also include `agreed_total`, `booking_source`, `finance_enabled`, and `stay_plan_json` for finance prompts and analytics drill-through. A pending-to-confirmed transition requires a total once migration is present; later status transitions retain the original workflow.

## Metric definitions and limitations

- Requests use creation date and **current** effective outcome. Confirmed requests with past check-in dates are effective no-shows, following the existing admin rule. Acceptance is confirmed/checked-in/completed/no-show requests divided by requests; cancellation is cancelled requests divided by requests; no-show rate is no-shows divided by accepted requests. Rates are descriptive cohort snapshots, not reconstructed historical funnels. Filtering status also narrows the denominators.
- Occupancy uses checked-in/completed scheduled nights before today, excluding check-out day, divided by current enabled non-archived room capacity times elapsed report days. Multi-room quantities count as multiple room-nights; party arrivals/guests count once per matching booking. Unknown inventory remains visible as a quality gap. Historical capacity, closures, actual arrival/departure timestamps, and unrecorded demand are unavailable.
- Agreed booking value and balance include whole confirmed/checked-in/completed bookings overlapping the period. These are booking values, not recognized accounting revenue or profit. Room filters do not apportion a combination's whole total. Coverage includes all matching bookings with and without totals. Payments/refunds use transaction dates even for cancelled bookings; balances use lifetime non-void transactions. Missing totals are never converted to zero.
- Activities count a single structured `service_name` for realized arrivals; multiple activities saved in notes cannot be reliably counted. No personal notes are parsed for analytics.
- Forecast dates and training are independent of report date/status filters; source and stay filters apply. A source-filtered occupancy is that source's share of configured capacity. Use the accommodation selector for an individually validated model; sparse accommodation history does not borrow a misleading resort-level model.

## Forecast model

Training uses up to three years of daily realized demand and excludes future observations, pending requests, cancellations and effective no-shows. Before 12 weeks/30 finalized bookings, output is existing reservations only, without prediction bands. Ridge regression becomes eligible after 26 weeks/60 finalized bookings; otherwise weekday baselines compete.

Candidates are seasonal-naive (previous matching weekday), exponentially weighted weekday mean over 12 weeks (weekly decay 0.85), and ridge regression (regularization 0.1) with intercept, linear time, weekday indicators, 7/14-day lags and a 28-day rolling mean. Annual sine/cosine features activate only after two years. Features and fitting use only observations preceding each validation origin. Recursive future lags use prior predictions.

Available 14/30/60/90-day holdout windows are evaluated using walk-forward origins. MAE selects the candidate, requiring at least 2% improvement to replace the current baseline; WAPE is also reported and is null for zero observed demand. This is a validation-based selection score, not an independent accuracy guarantee. Historical status/date corrections cannot be reconstructed as-of each origin; this limitation is disclosed.

Room predictions are bounded by current capacity (existing reservations above capacity remain visible and flagged). Arrival/guest extrapolation is bounded by twice the training maximum. Existing future confirmed/checked-in reservations form a scenario floor; this does not guarantee attendance. Pending room demand is displayed separately. Bands use the tenth/ninetieth percentiles of validation residuals. Weekly bands sum daily bounds and are not calibrated weekly confidence intervals.

Models run in PHP on request. Report cache keys include the model version, Manila day, filters, relevant bookings, payments, transitions and inventory. Changed data creates a fresh key. Cache lifetime is six hours, and expired rows are pruned in bounded batches. No customer-level rows are stored in the analytics cache.

## Gemini configuration and boundary

Reuse server-only `GEMINI_API_KEY` and `GEMINI_MODEL`; no new credentials are exposed to React. Validate a supported model for the account before a real provider smoke test. Missing credentials or provider failures leave all reports and local forecasts available. Analytics uses Gemini's native `generateContent` structured-output fields, `generationConfig.responseMimeType` and `generationConfig.responseJsonSchema`, described in [Google's structured output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).

If generation fails, the browser console records a privacy-safe diagnostic code, stage, HTTP status when available, and reference ID. The PHP error log receives the same reference as an `analytics_ai_failure` entry. Prompts, provider response text, credentials and booking records are never logged. A structurally generated response that fails the strict safety validator is retried once with a correction prompt; validation is not weakened.

The payload explicitly includes allowed KPI values, monthly totals, categorical source/status/weekday counts, numerical forecast summaries and model scores. It omits guest/contact information, booking/payment references, arbitrary text, accommodation names, notes, and raw ledger rows. Provider text is validated for shape, length, allowed evidence keys and numeric-digit claims; the interface renders it as plain text and displays verified numbers separately. Text remains AI advice requiring human review; schema validation cannot prove the truth of prose or inferred causes.

Insight caching keys include source-data hash, model name and prompt version. Identical successful results are reused for six hours; failures are not cached. Persistent quotas allow six uncached attempts per admin per hour and thirty globally per hour, including failed attempts. Call timeout is 25 seconds, response size is bounded, redirects are disabled and credentials are sent in a header to a fixed HTTPS host. The AI has no database tools or mutation capability.

Forecast validation design follows [time-series cross-validation](https://otexts.com/fpp3/tscv.html). Neither ML nor Gemini guarantees better analysis when history is short or inaccurate.

## Focused verification

```powershell
C:\xampp\php\php.exe scripts/local/test-analytics.php
C:\xampp\php\php.exe scripts/local/test-analytics-database.php
C:\xampp\php\php.exe scripts/local/test-facebook.php
C:\xampp\php\php.exe scripts/local/test-website-chat.php
node scripts/local/test-analytics-browser.mjs
node scripts/local/test-analytics-browser.mjs --mock
npm.cmd run build
git diff --check
```

The database test uses rollback for its booking/ledger fixtures and a mocked provider. The browser/API smoke test requires the existing XAMPP/Vite servers and Chrome, creates then destroys a local test admin session, launches a temporary headless browser profile, checks the existing Vite proxy and three viewport widths, and leaves booking records unchanged. It does not call Gemini. The helper is CLI-only and all such tools remain under `scripts/local/`.

### Verification on 2026-09-20

Migration 013 was applied locally with the MySQL administration CLI after a recovery backup; all ten existing bookings were preserved. The application account retained its restricted privileges. The calculation/ML tests, database ledger and mocked-AI tests, authenticated API/Vite checks, browser checks at 1440/768/390 pixels, finance modal/confirmation checks, website-chat suite, changed-file PHP syntax checks and production build passed. No live Gemini request was made.

The Facebook suite fails at `Short casual date inquiry revises a confirmation instead of triggering its invalid-answer reminder`. Running the same test against the committed pre-change automation module reproduces that failure. This existing date-case issue was left unchanged. There are currently only two completed bookings, so real-data forecasts correctly remain in the insufficient-history state.
