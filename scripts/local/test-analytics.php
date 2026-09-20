<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/analytics/insights.php';
function analyticsCheck(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function analyticsReject(callable $action, string $message): void {
    try { $action(); } catch (InvalidArgumentException) { return; }
    throw new RuntimeException($message);
}
try {
    analyticsReject(static fn() => financeCents(12.34), 'Float input rejected');
    analyticsReject(static fn() => financeCents('-1.00'), 'Negative amount rejected');
    analyticsReject(static fn() => financeCents('1.001'), 'Fractional cent rejected');
    analyticsCheck(financeCents('9999999999.99') === 999999999999 && financeDecimal(101) === '1.01', 'Exact centavo arithmetic');
    analyticsReject(static fn() => financeRequireTotal(['agreed_total' => null]), 'Missing total cannot confirm');
    financeRequireTotal(['agreed_total' => '0.00']);
    analyticsReject(static fn() => analyticsFilters(['preset' => 'custom', 'from' => '2026-02-30', 'to' => '2026-03-10'], '2026-09-20'), 'Invalid date rejected');
    analyticsReject(static fn() => analyticsFilters(['source' => "all' OR 1=1"], '2026-09-20'), 'Invalid source rejected');
    $stays = [['id' => 1, 'name' => 'Room A', 'style' => 'standard', 'room_count' => 4, 'archived' => false, 'enabled' => true]];
    $base = ['id' => 1, 'check_in' => '2026-09-10', 'check_out' => '2026-09-13', 'guests' => 6, 'stay_id' => null, 'stay_type' => 'Combination',
        'stay_plan_json' => '[{"stay_id":1,"quantity":2}]', 'service_name' => null, 'status' => 'completed', 'created_at' => '2026-09-01 10:00:00', 'updated_at' => '2026-09-13 10:00:00', 'agreed_total' => '3000.00', 'booking_source' => 'website'];
    $bookings = [$base, array_replace($base, ['id' => 2, 'status' => 'cancelled', 'agreed_total' => null, 'booking_source' => 'unknown']), array_replace($base, ['id' => 3, 'status' => 'confirmed', 'agreed_total' => null])];
    $payments = [['booking_id' => 1, 'kind' => 'payment', 'amount' => '1000.10', 'paid_on' => '2026-09-09', 'voided_at' => null], ['booking_id' => 2, 'kind' => 'refund', 'amount' => '500.00', 'paid_on' => '2026-09-10', 'voided_at' => null]];
    $filters = analyticsFilters(['preset' => 'custom', 'from' => '2026-09-11', 'to' => '2026-09-12'], '2026-09-20');
    $report = analyticsReport($bookings, $stays, $payments, [], $filters, '2026-09-20');
    analyticsCheck($report['metrics']['room_nights'] === 4 && $report['metrics']['occupancy'] === 50.0, 'Clipped multi-room nights and occupancy');
    analyticsCheck($report['metrics']['booked_value'] === '3000.00' && $report['metrics']['outstanding'] === '1999.90', 'Exact matching-booking totals and balance');
    analyticsCheck($report['metrics']['collected'] === '0.00' && $report['metrics']['arrivals'] === 0, 'Transaction and arrival date bases');
    analyticsCheck($report['metrics']['missing_totals'] === 2 && $report['forecast']['models']['rooms']['model'] === 'on_books_only', 'Legacy coverage and insufficient history');
    $full = analyticsReport($bookings, $stays, $payments, [], analyticsFilters(['preset' => '30'], '2026-09-20'), '2026-09-20');
    analyticsCheck($full['metrics']['requests'] === 3 && $full['metrics']['no_show_requests'] === 1 && $full['metrics']['guest_arrivals'] === 6, 'Current request outcomes and guests not multiplied by room count');
    analyticsCheck($full['metrics']['collected'] === '1000.10' && $full['metrics']['refunded'] === '500.00', 'Payments and cancelled-booking refunds by transaction date');
    $dates = analyticsDays('2024-01-01', '2025-04-24');
    $seasonal = array_map(static fn($date) => (int) (new DateTimeImmutable($date))->format('N') >= 6 ? 8.0 : 2.0, array_slice($dates, 0, 390));
    $model = forecastSeries($seasonal, $dates, array_fill(0, 90, 0), 100, 10.0);
    analyticsCheck($model['model'] === 'seasonal_naive' && $model['scores']['seasonal_naive']['mae'] === 0.0, 'Exact seasonality keeps baseline');
    analyticsCheck($model === forecastSeries($seasonal, $dates, array_fill(0, 90, 0), 100, 10.0), 'Forecast deterministic');
    $trend = array_map(static fn($i) => 3 + $i / 30 + (($i % 7) < 2 ? 2 : 0), range(0, 389));
    $trained = forecastSeries($trend, $dates, array_fill(0, 90, 0), 100, 100.0);
    analyticsCheck($trained['model'] === 'ridge' && $trained['scores']['ridge']['mae'] < $trained['scores']['seasonal_naive']['mae'], 'Ridge selected on a predictable trend');
    $prefix = array_slice($trend, 0, 300);
    $prediction = forecastPredict($prefix, $dates, 90, 'ridge');
    $altered = $trend; for ($i = 300; $i < 390; $i++) $altered[$i] = 100000;
    analyticsCheck($prediction === forecastPredict(array_slice($altered, 0, 300), $dates, 90, 'ridge'), 'Holdout targets never enter training');
    $zero = forecastSeries(array_fill(0, 390, 0), $dates, array_fill(0, 90, 3), 100, 10.0);
    analyticsCheck($zero['scores']['seasonal_naive']['wape'] === null && $zero['points'][0]['value'] === 3.0, 'Zero demand and on-books floor');
    foreach ($trained['points'] as $point) analyticsCheck($point['lower'] >= 0 && $point['lower'] <= $point['value'] && $point['upper'] >= $point['value'], 'Ordered nonnegative bands');
    $report['guest_name'] = 'PRIVATE NAME'; $report['metrics']['phone'] = 'PRIVATE PHONE';
    $facts = analyticsInsightFacts($report); $payload = json_encode(analyticsInsightPayload($facts));
    analyticsCheck(!str_contains($payload, 'PRIVATE') && !str_contains($payload, 'Room A'), 'AI payload uses aggregate allowlist without customer or free-text labels');
    analyticsCheck(isset($facts['evidence']['next_30_forecast_room_nights'], $facts['evidence']['next_30_on_books_room_nights'], $facts['evidence']['next_30_expected_additional_room_nights']), 'AI receives verified owner-ready forecast evidence');
    $valid = ['summary' => 'History is limited.', 'insights' => [['title' => 'Improve coverage', 'observation' => 'Some totals are missing.', 'action' => 'Review agreed totals.', 'confidence' => 'low', 'evidence' => ['missing_totals']]], 'caveat' => 'Existing reservations are uncertain.'];
    analyticsCheck(analyticsValidateInsights($valid, $facts['evidence']) !== null, 'Valid evidence grounded response');
    $bad = $valid; $bad['insights'][0]['evidence'] = ['invented_revenue']; analyticsCheck(analyticsValidateInsights($bad, $facts['evidence']) === null, 'Unknown evidence rejected');
    $bad = $valid; $bad['summary'] = 'Expect 900 bookings'; analyticsCheck(analyticsValidateInsights($bad, $facts['evidence']) === null, 'Generated numeric claim rejected');
    analyticsCheck(analyticsValidateInsights(['summary' => 'Incomplete'], $facts['evidence']) === null, 'Malformed response rejected');
    $mock = analyticsMockDataset($stays, [['name' => 'Kayaking']], '2026-09-20', 42);
    analyticsCheck($mock === analyticsMockDataset($stays, [['name' => 'Kayaking']], '2026-09-20', 42), 'Mock seed repeatable');
    analyticsCheck($mock !== analyticsMockDataset($stays, [['name' => 'Kayaking']], '2026-09-20', 43), 'New seed changes mock data');
    $mockReport = analyticsReport($mock['bookings'], $stays, $mock['payments'], $mock['transitions'], analyticsFilters([], '2026-09-20'), '2026-09-20');
    analyticsCheck($mockReport['forecast']['models']['rooms']['ml_eligible'] && $mockReport['metrics']['requests'] > 30, 'Mock history unlocks ML');
    analyticsCheck((float) $mockReport['metrics']['collected'] > 0 && (float) $mockReport['metrics']['refunded'] > 0, 'Mock financial examples');
    analyticsCheck(count(array_filter($mock['bookings'], static fn($row) => $row['id'] >= 0)) === 0, 'Mock IDs cannot address real bookings');
    analyticsReject(static fn() => analyticsFilters(['dataset' => 'mock', 'seed' => '-1']), 'Mock seed validated');
    analyticsReject(static fn() => analyticsFilters(['dataset' => 'other']), 'Dataset validated');
    $mockReport['dataset'] = 'mock';
    analyticsCheck(str_contains(analyticsInsightFacts($mockReport)['dataset'], 'synthetic'), 'AI knows data is synthetic');
    $originalFlag = getenv('ANALYTICS_MOCK_DATA_ENABLED');
    putenv('ANALYTICS_MOCK_DATA_ENABLED=0');
    analyticsCheck(!analyticsMockAllowed(), 'Mock access defaults to disabled');
    if ($originalFlag === false) putenv('ANALYTICS_MOCK_DATA_ENABLED'); else putenv('ANALYTICS_MOCK_DATA_ENABLED=' . $originalFlag);
    echo "Passed analytics aggregation, exact finance arithmetic, thresholds, seasonal/trend model selection, holdout isolation, deterministic forecasts, bands and AI privacy/schema tests.\n";
} catch (Throwable $error) { fwrite(STDERR, 'Analytics test failed: ' . $error->getMessage() . "\n"); exit(1); }
