<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/resort/resort.php';
require_once dirname(__DIR__) . '/bookings/booking-finance.php';
require_once __DIR__ . '/forecast.php';
require_once __DIR__ . '/mock-data.php';

function analyticsToday(): string { return (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d'); }
function analyticsDays(string $from, string $to): array
{
    $days = [];
    for ($day = new DateTimeImmutable($from); $day->format('Y-m-d') <= $to; $day = $day->modify('+1 day')) $days[] = $day->format('Y-m-d');
    return $days;
}
function analyticsFilters(array $input, ?string $today = null): array
{
    $today ??= analyticsToday();
    $dataset = $input['dataset'] ?? 'live';
    if (!in_array($dataset, ['live', 'mock'], true)) throw new InvalidArgumentException('Choose a valid dataset.');
    $seed = $dataset === 'mock' ? filter_var($input['seed'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483646]]) : null;
    if ($dataset === 'mock' && $seed === false) throw new InvalidArgumentException('Generate a mock dataset first.');
    $preset = $input['preset'] ?? '90';
    if (!in_array($preset, ['30','90','365','custom'], true)) throw new InvalidArgumentException('Choose a valid date range.');
    $end = $preset === 'custom' ? ($input['to'] ?? null) : $today;
    $start = $preset === 'custom' ? ($input['from'] ?? null) : (new DateTimeImmutable($today))->modify('-' . ((int) $preset - 1) . ' days')->format('Y-m-d');
    foreach ([$start, $end] as $value) {
        $date = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if (!$date || $date->format('Y-m-d') !== $value || $value < '2000-01-01') throw new InvalidArgumentException('Enter valid analytics dates.');
    }
    if ($end < $start || $end > $today || (new DateTimeImmutable($start))->diff(new DateTimeImmutable($end))->days > 1095) throw new InvalidArgumentException('Use up to three years of history ending no later than today.');
    $source = $input['source'] ?? 'all';
    $status = $input['status'] ?? 'all';
    if (!in_array($source, ['all','website','website_chat','facebook','manual','unknown'], true) || !in_array($status, ['all','pending','confirmed','checked_in','completed','cancelled','no_show'], true)) throw new InvalidArgumentException('Choose a valid source and status.');
    $stay = filter_var($input['stay_id'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    if ($stay === false) throw new InvalidArgumentException('Choose a valid accommodation.');
    return ['preset' => $preset, 'from' => $start, 'to' => $end, 'source' => $source, 'status' => $status, 'stay_id' => $stay, 'dataset' => $dataset, 'seed' => $seed];
}
function analyticsEffectiveStatus(array $booking, string $today): string
{
    return $booking['status'] === 'confirmed' && $booking['check_in'] < $today ? 'no_show' : $booking['status'];
}
function analyticsPlan(array $booking, array $stays): array
{
    $plan = json_decode((string) ($booking['stay_plan_json'] ?? ''), true);
    $units = [];
    if (is_array($plan) && $plan !== []) {
        foreach ($plan as $item) {
            $id = (int) ($item['stay_id'] ?? 0); $quantity = (int) ($item['quantity'] ?? 0);
            if ($id > 0 && $quantity > 0 && $quantity <= 1000) $units[$id] = ($units[$id] ?? 0) + $quantity;
        }
    } elseif (!empty($booking['stay_id'])) $units[(int) $booking['stay_id']] = 1;
    else foreach ($stays as $stay) if (strcasecmp($booking['stay_type'] ?? '', $stay['name']) === 0) { $units[(int) $stay['id']] = 1; break; }
    return $units;
}
function analyticsMatches(array $booking, array $filters, bool $status = true): bool
{
    return ($filters['source'] === 'all' || $booking['booking_source'] === $filters['source'])
        && (!$status || $filters['status'] === 'all' || $booking['effective_status'] === $filters['status'])
        && (!$filters['stay_id'] || isset($booking['units'][$filters['stay_id']]));
}
function analyticsCacheGet(PDO $db, string $key): ?array
{
    $query = $db->prepare('SELECT payload FROM analytics_cache WHERE cache_key = ? AND expires_at > NOW()');
    $query->execute([$key]); $value = $query->fetchColumn();
    return $value === false ? null : json_decode($value, true, 64, JSON_THROW_ON_ERROR);
}
function analyticsCachePut(PDO $db, string $key, array $data): void
{
    $db->prepare('INSERT INTO analytics_cache (cache_key, payload, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 6 HOUR)) ON DUPLICATE KEY UPDATE payload = VALUES(payload), expires_at = VALUES(expires_at)')->execute([$key, json_encode($data, JSON_THROW_ON_ERROR)]);
    $db->exec('DELETE FROM analytics_cache WHERE expires_at < NOW() LIMIT 100');
}

function analyticsReport(array $bookings, array $stays, array $payments, array $transitions, array $filters, string $today): array
{
    $capacity = 0; $stayOptions = [];
    foreach ($stays as $stay) {
        $units = $stay['style'] === 'exclusive' ? 1 : max(1, (int) $stay['room_count']);
        if (!$stay['archived'] && $stay['enabled'] && (!$filters['stay_id'] || (int) $stay['id'] === $filters['stay_id'])) $capacity += $units;
        $stayOptions[] = ['id' => (int) $stay['id'], 'name' => $stay['name']];
    }
    $mapped = []; $first = $today;
    foreach ($bookings as $booking) {
        $booking['units'] = analyticsPlan($booking, $stays);
        $booking['effective_status'] = analyticsEffectiveStatus($booking, $today);
        $mapped[(int) $booking['id']] = $booking;
        if (analyticsMatches($booking, $filters, false)) $first = min($first, substr($booking['created_at'], 0, 10), $booking['check_in']);
    }
    $metrics = array_fill_keys(['requests','accepted_requests','cancelled_requests','no_show_requests','arrivals','guest_arrivals','realized_stays','room_nights','pending_requests','booked_value','collected','refunded','outstanding','missing_totals','priced_bookings','unknown_sources','unmapped_stays','overdue_checkouts'], 0);
    $series = [];
    foreach (analyticsDays($filters['from'], $filters['to']) as $date) $series[$date] = ['date' => $date, 'requests' => 0, 'arrivals' => 0, 'guest_arrivals' => 0, 'room_nights' => 0, 'collected' => 0, 'refunded' => 0];
    $breakdowns = ['status' => [], 'source' => [], 'accommodation' => [], 'activity' => [], 'weekday' => [], 'month' => []];
    $nightsSum = $leadSum = $leadSamples = $arrivalsCount = 0;
    $netByBooking = [];
    foreach ($payments as $payment) {
        if ($payment['voided_at'] !== null) continue;
        $netByBooking[$payment['booking_id']] = ($netByBooking[$payment['booking_id']] ?? 0) + ($payment['kind'] === 'payment' ? 1 : -1) * financeCents($payment['amount']);
    }
    foreach ($mapped as $booking) {
        if (!analyticsMatches($booking, $filters)) continue;
        $status = $booking['effective_status'];
        $created = substr($booking['created_at'], 0, 10);
        $inRequestRange = isset($series[$created]);
        $inStayRange = $booking['check_in'] <= $filters['to'] && $booking['check_out'] > $filters['from'];
        if ($inRequestRange) {
            $metrics['requests']++; $series[$created]['requests']++;
            $metrics['accepted_requests'] += in_array($status, ['confirmed','checked_in','completed','no_show'], true) ? 1 : 0;
            $metrics['cancelled_requests'] += $status === 'cancelled' ? 1 : 0;
            $metrics['no_show_requests'] += $status === 'no_show' ? 1 : 0;
            $metrics['pending_requests'] += $status === 'pending' ? 1 : 0;
            $metrics['unknown_sources'] += $booking['booking_source'] === 'unknown' ? 1 : 0;
            foreach (['status' => $status, 'source' => $booking['booking_source']] as $group => $key) $breakdowns[$group][$key] = ($breakdowns[$group][$key] ?? 0) + 1;
        }
        if (!$inStayRange) continue;
        $metrics['unmapped_stays'] += $booking['units'] === [] ? 1 : 0;
        if ($booking['agreed_total'] === null) $metrics['missing_totals']++; else $metrics['priced_bookings']++;
        if (in_array($status, ['confirmed','checked_in','completed'], true) && $booking['agreed_total'] !== null) {
            $total = financeCents($booking['agreed_total']);
            $metrics['booked_value'] += $total;
            $metrics['outstanding'] += max(0, $total - ($netByBooking[$booking['id']] ?? 0));
        }
        $metrics['overdue_checkouts'] += $status === 'checked_in' && $booking['check_out'] < $today ? 1 : 0;
        if (!in_array($status, ['checked_in','completed'], true)) continue;
        $units = $filters['stay_id'] ? ($booking['units'][$filters['stay_id']] ?? 0) : array_sum($booking['units']);
        $metrics['realized_stays']++;
        if (isset($series[$booking['check_in']])) {
            $metrics['arrivals']++; $metrics['guest_arrivals'] += (int) $booking['guests'];
            $series[$booking['check_in']]['arrivals']++; $series[$booking['check_in']]['guest_arrivals'] += (int) $booking['guests'];
            $arrivalsCount++;
            $nightsSum += (new DateTimeImmutable($booking['check_in']))->diff(new DateTimeImmutable($booking['check_out']))->days;
            if ($created <= $booking['check_in']) { $leadSum += (new DateTimeImmutable($created))->diff(new DateTimeImmutable($booking['check_in']))->days; $leadSamples++; }
            $activity = $booking['service_name'] ?: 'Not structured / none';
            $breakdowns['activity'][$activity] = ($breakdowns['activity'][$activity] ?? 0) + 1;
        }
        $end = min($filters['to'], (new DateTimeImmutable($booking['check_out']))->modify('-1 day')->format('Y-m-d'), (new DateTimeImmutable($today))->modify('-1 day')->format('Y-m-d'));
        foreach (analyticsDays(max($filters['from'], $booking['check_in']), $end) as $date) {
            $metrics['room_nights'] += $units; $series[$date]['room_nights'] += $units;
            $weekday = (new DateTimeImmutable($date))->format('D'); $month = substr($date, 0, 7);
            $breakdowns['weekday'][$weekday] = ($breakdowns['weekday'][$weekday] ?? 0) + $units;
            $breakdowns['month'][$month] = ($breakdowns['month'][$month] ?? 0) + $units;
            foreach ($booking['units'] as $id => $quantity) if (!$filters['stay_id'] || $filters['stay_id'] === $id) {
                $label = 'Unknown accommodation';
                foreach ($stays as $stay) if ((int) $stay['id'] === $id) { $label = $stay['name']; break; }
                $breakdowns['accommodation'][$label] = ($breakdowns['accommodation'][$label] ?? 0) + $quantity;
            }
        }
    }
    foreach ($payments as $payment) {
        $booking = $mapped[$payment['booking_id']] ?? null;
        if (!$booking || $payment['voided_at'] !== null || !analyticsMatches($booking, $filters) || !isset($series[$payment['paid_on']])) continue;
        $key = $payment['kind'] === 'payment' ? 'collected' : 'refunded';
        $amount = financeCents($payment['amount']);
        $metrics[$key] += $amount; $series[$payment['paid_on']][$key] += $amount;
    }
    $recordedTransitions = [];
    foreach ($transitions as $transition) {
        $booking = $mapped[$transition['booking_id']] ?? null;
        if ($booking && analyticsMatches($booking, $filters) && isset($series[substr($transition['created_at'], 0, 10)])) $recordedTransitions[$transition['new_status']] = ($recordedTransitions[$transition['new_status']] ?? 0) + 1;
    }
    $pastDays = count(array_filter(array_keys($series), static fn($day) => $day < $today));
    $ratio = static fn($a, $b) => $b > 0 ? round($a / $b * 100, 2) : null;
    $metrics += ['occupancy' => $ratio($metrics['room_nights'], $capacity * $pastDays), 'conversion_rate' => $ratio($metrics['accepted_requests'], $metrics['requests']),
        'cancellation_rate' => $ratio($metrics['cancelled_requests'], $metrics['requests']), 'no_show_rate' => $ratio($metrics['no_show_requests'], $metrics['accepted_requests']),
        'financial_coverage' => $ratio($metrics['priced_bookings'], $metrics['priced_bookings'] + $metrics['missing_totals']),
        'average_stay' => $arrivalsCount ? round($nightsSum / $arrivalsCount, 2) : null, 'average_lead_days' => $leadSamples ? round($leadSum / $leadSamples, 2) : null];
    foreach (['booked_value','collected','refunded','outstanding'] as $key) $metrics[$key] = financeDecimal($metrics[$key]);
    foreach ($series as &$point) { foreach (['collected','refunded'] as $key) $point[$key] = financeDecimal($point[$key]); } unset($point);
    $forecast = analyticsForecast($mapped, $filters, $capacity, $first, $today);
    return ['filters' => $filters, 'metrics' => $metrics, 'series' => array_values($series), 'breakdowns' => $breakdowns, 'recorded_transitions' => $recordedTransitions,
        'accommodations' => $stayOptions, 'forecast' => $forecast, 'capacity' => $capacity,
        'notes' => [
            'Request rates describe current outcomes of requests created in the selected period, not their historical status at that time. Recorded transitions start after analytics installation.',
            'Occupancy uses completed/checked-in bookings, scheduled nights before today, and current enabled inventory. Historical capacity, closures and actual arrival/departure times are not recorded.',
            'Financial totals cover whole bookings overlapping the period; a room filter does not split a combined booking price. Collections use payment dates and include refunds for cancelled bookings.',
            'Arrivals and guest counts describe whole parties matching the accommodation filter. Activity breakdown covers the single structured activity only; multi-activity notes are excluded.',
            'Forecasts start today and use all available history (up to three years), independently of report dates and status. Source and accommodation filters apply. Source-filtered occupancy is a share of total capacity.',
            'Unrecorded demand, status corrections, missing totals, test data and inventory changes can affect analysis. Future confirmed demand is a reservation scenario, not a guarantee of attendance.',
        ]];
}

function analyticsForecast(array $bookings, array $filters, int $capacity, string $first, string $today): array
{
    $start = max($first, (new DateTimeImmutable($today))->modify('-1095 days')->format('Y-m-d'));
    $last = (new DateTimeImmutable($today))->modify('+89 days')->format('Y-m-d');
    $dates = analyticsDays($start, $last);
    $counts = array_fill_keys($dates, ['rooms' => 0, 'arrivals' => 0, 'guests' => 0, 'pending' => 0]);
    $samples = 0;
    foreach ($bookings as $booking) {
        if (!analyticsMatches($booking, $filters, false)) continue;
        $state = $booking['effective_status'];
        $realized = in_array($state, ['completed','checked_in'], true);
        if ($realized && $booking['check_out'] <= $today && $booking['check_out'] > $start) $samples++;
        $units = $filters['stay_id'] ? ($booking['units'][$filters['stay_id']] ?? 0) : array_sum($booking['units']);
        $end = min($last, (new DateTimeImmutable($booking['check_out']))->modify('-1 day')->format('Y-m-d'));
        foreach (analyticsDays(max($start, $booking['check_in']), $end) as $day) {
            if ($state === 'pending' && $day >= $today) { $counts[$day]['pending'] += $units; continue; }
            if ($day < $today ? !$realized : !in_array($state, ['confirmed','checked_in'], true)) continue;
            $counts[$day]['rooms'] += $units;
            if ($booking['check_in'] === $day) { $counts[$day]['arrivals']++; $counts[$day]['guests'] += (int) $booking['guests']; }
        }
    }
    $historyCount = count(array_filter($dates, static fn($date) => $date < $today));
    $result = ['version' => ANALYTICS_MODEL_VERSION, 'samples' => $samples, 'history_days' => $historyCount, 'daily' => [], 'weekly' => [], 'models' => []];
    foreach (['rooms','arrivals','guests'] as $metric) {
        $all = array_column(array_values($counts), $metric);
        $model = forecastSeries(array_slice($all, 0, $historyCount), $dates, array_slice($all, $historyCount), $samples, $metric === 'rooms' && $capacity > 0 ? (float) $capacity : null);
        $points = $model['points']; unset($model['points']); $result['models'][$metric] = $model;
        foreach ($points as $i => $point) {
            $result['daily'][$i]['date'] = $point['date'];
            $result['daily'][$i][$metric] = $point;
            $result['daily'][$i]['occupancy'] = $capacity > 0 ? round(($result['daily'][$i]['rooms']['value'] ?? 0) / $capacity * 100, 2) : null;
            $result['daily'][$i]['pending_room_nights'] = $counts[$point['date']]['pending'];
            $result['daily'][$i]['over_capacity'] = ($result['daily'][$i]['rooms']['on_books'] ?? 0) > $capacity;
        }
    }
    foreach (array_chunk(array_slice($result['daily'], 30), 7) as $week) {
        $row = ['from' => $week[0]['date'], 'to' => end($week)['date'], 'days' => count($week)];
        foreach (['rooms','arrivals','guests'] as $metric) {
            foreach (['value','on_books','lower','upper'] as $key) {
                $values = array_column(array_column($week, $metric), $key);
                $row[$metric][$key] = in_array(null, $values, true) ? null : round(array_sum($values), 2);
            }
        }
        $row['occupancy'] = $capacity ? round($row['rooms']['value'] / ($capacity * count($week)) * 100, 2) : null;
        $row['over_capacity'] = count(array_filter($week, static fn($day) => $day['over_capacity'])) > 0;
        $result['weekly'][] = $row;
    }
    $result['daily'] = array_slice($result['daily'], 0, 30);
    return $result;
}

function analyticsLoad(PDO $db, array $filters): array
{
    $mock = ($filters['dataset'] ?? 'live') === 'mock';
    if ($mock && !analyticsMockAllowed()) throw new RuntimeException('Mock analytics are disabled in this environment.', 403);
    if (!analyticsSchemaReady($db)) throw new RuntimeException('Analytics setup is pending. Apply migration 013 through database administration.', 503);
    $db->exec("SET time_zone = '+08:00'");
    $db->beginTransaction();
    try {
        $stays = resortEntities($db, 'stays', true);
        if ($filters['stay_id'] && !in_array($filters['stay_id'], array_column($stays, 'id'), true)) throw new InvalidArgumentException('Accommodation not found.');
        if ($mock) {
            $sample = analyticsMockDataset($stays, resortEntities($db, 'services', false), analyticsToday(), $filters['seed']);
            $bookings = $sample['bookings']; $payments = $sample['payments']; $transitions = $sample['transitions'];
        } else {
        if ((int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn() > 50000) throw new RuntimeException('Analytics history exceeds this release’s processing limit.', 503);
        $bookings = $db->query('SELECT id, check_in, check_out, guests, stay_id, stay_type, stay_plan_json, service_name, status, created_at, updated_at, agreed_total, booking_source FROM bookings ORDER BY id')->fetchAll();
        $payments = $db->query('SELECT booking_id, kind, amount, paid_on, voided_at FROM booking_payments ORDER BY id')->fetchAll();
        $transitions = $db->query('SELECT booking_id, new_status, created_at FROM booking_status_history ORDER BY id')->fetchAll();
        }
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    $today = analyticsToday();
    $key = hash('sha256', json_encode(['mock-support-v1', ANALYTICS_MODEL_VERSION, $today, $filters, $bookings, $payments, $transitions, $stays], JSON_THROW_ON_ERROR));
    $report = analyticsCacheGet($db, $key);
    if ($report === null) {
        $report = analyticsReport($bookings, $stays, $payments, $transitions, $filters, $today);
        $report['generated_at'] = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format(DATE_ATOM);
        $report['data_hash'] = $key;
        $report['dataset'] = $mock ? 'mock' : 'live';
        $report['mock_booking_count'] = $mock ? count($bookings) : 0;
        analyticsCachePut($db, $key, $report);
    }
    $report['mock_available'] = analyticsMockAllowed();
    return $report;
}
