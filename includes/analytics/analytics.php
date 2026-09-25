<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bookings/booking-reporting.php';

function analyticsToday(): string { return (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d'); }

function analyticsFilters(array $input, string $today, string $first): array
{
    $preset = $input['preset'] ?? 'rolling';
    $year = substr($today, 0, 4);
    $ranges = [
        'rolling' => [(new DateTimeImmutable(substr($today, 0, 7) . '-01'))->modify('-11 months')->format('Y-m-d'), $today],
        'year' => [$year . '-01-01', $year . '-12-31'],
        'previous' => [((int) $year - 1) . '-01-01', ((int) $year - 1) . '-12-31'],
        'all' => [$first, $today],
        'custom' => [$input['from'] ?? '', $input['to'] ?? ''],
    ];
    if (!is_string($preset) || !isset($ranges[$preset])) throw new InvalidArgumentException('Choose a valid reporting period.');
    [$from, $to] = $ranges[$preset];
    foreach ([$from, $to] as $value) {
        $date = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if (!$date || $date->format('Y-m-d') !== $value || $value < '2000-01-01' || $value > '2100-12-31') throw new InvalidArgumentException('Enter valid dates between 2000 and 2100.');
    }
    if ($from > $to) throw new InvalidArgumentException('The end date must be after the start date.');
    $source = $input['source'] ?? 'all'; $status = $input['status'] ?? 'all'; $group = $input['group'] ?? 'month';
    if (!in_array($source, ['all','website','website_chat','facebook','manual','unknown'], true)
        || !in_array($status, ['all','pending','confirmed','checked_in','completed','cancelled','no_show'], true)
        || !in_array($group, ['month','year'], true)) throw new InvalidArgumentException('Choose valid report filters.');
    $ids = [];
    foreach (['stay_id','activity_id'] as $key) {
        $ids[$key] = filter_var($input[$key] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($ids[$key] === false) throw new InvalidArgumentException('Choose valid catalog filters.');
    }
    return compact('preset','from','to','source','status','group') + $ids;
}

function analyticsEmptyRow(string $period): array
{
    return ['period' => $period] + array_fill_keys(['requests','cancelled_requests','stays','guests','agreed','estimated','booked','pipeline','paid','refunded','net','outstanding','unpriced','estimated_bookings','priced_bookings'], 0);
}

/** Pure aggregation, using integer centavos. Inputs contain no guest identities. */
function analyticsReport(array $bookings, array $payments, array $activities, array $stays, array $filters, string $today): array
{
    $rows = [];
    $date = new DateTimeImmutable(substr($filters['from'], 0, 7) . '-01');
    while ($date->format('Y-m') <= substr($filters['to'], 0, 7)) {
        $key = $date->format('Y-m'); $rows[$key] = analyticsEmptyRow($key); $date = $date->modify('+1 month');
    }
    $inside = static fn(string $date): bool => $date >= $filters['from'] && $date <= $filters['to'];
    $byActivity = []; $byBooking = []; $statusCounts = []; $sourceCounts = []; $accommodations = []; $netByBooking = [];
    foreach ($activities as $activity) $byActivity[(int) $activity['booking_id']][(int) $activity['service_id']] = $activity['service_name'];
    foreach ($payments as $payment) {
        if ($payment['voided_at'] !== null || $payment['paid_on'] > min($today, $filters['to'])) continue;
        $id = (int) $payment['booking_id'];
        $netByBooking[$id] = ($netByBooking[$id] ?? 0) + ($payment['kind'] === 'payment' ? 1 : -1) * (isset($payment['cents']) ? (int) $payment['cents'] : financeCents($payment['amount']));
    }
    $activityCounts = []; $unmapped = 0;
    foreach ($bookings as $booking) {
        $id = (int) $booking['id'];
        $units = bookingReportingUnits($booking, $stays);
        $status = $booking['status'] === 'confirmed' && $booking['check_in'] < $today ? 'no_show' : $booking['status'];
        $selectedActivities = $byActivity[$id] ?? [];
        if (($filters['source'] !== 'all' && $booking['booking_source'] !== $filters['source'])
            || ($filters['status'] !== 'all' && $status !== $filters['status'])
            || ($filters['stay_id'] && !isset($units[$filters['stay_id']]))
            || ($filters['activity_id'] && !isset($selectedActivities[$filters['activity_id']]))) continue;
        $byBooking[$id] = true;
        $created = substr($booking['created_at'], 0, 10);
        if ($inside($created)) {
            $row =& $rows[substr($created, 0, 7)];
            $row['requests']++; $row['cancelled_requests'] += $status === 'cancelled' ? 1 : 0;
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
            $sourceCounts[$booking['booking_source']] = ($sourceCounts[$booking['booking_source']] ?? 0) + 1;
            foreach ($selectedActivities as $activityId => $name) {
                if (!isset($activityCounts[$activityId])) $activityCounts[$activityId] = ['id' => $activityId, 'name' => $name, 'requests' => 0, 'guests' => 0];
                $activityCounts[$activityId]['requests']++;
                $activityCounts[$activityId]['guests'] += (int) $booking['guests'];
            }
            unset($row);
        }
        if (!$inside($booking['check_in'])) continue;
        $row =& $rows[substr($booking['check_in'], 0, 7)];
        $value = $booking['agreed_total'] ?? $booking['estimated_total'];
        $cents = $value === null ? null : financeCents($value);
        if ($status === 'pending') $row['pipeline'] += $cents ?? 0;
        if (!in_array($status, ['confirmed','checked_in','completed'], true)) { unset($row); continue; }
        $row['stays']++; $row['guests'] += (int) $booking['guests'];
        $row['unpriced'] += $cents === null ? 1 : 0;
        $row['estimated_bookings'] += $cents !== null && $booking['agreed_total'] === null ? 1 : 0;
        $row['priced_bookings'] += $cents !== null ? 1 : 0;
        $row['booked'] += $cents ?? 0;
        $row[$booking['agreed_total'] !== null ? 'agreed' : 'estimated'] += $cents ?? 0;
        $row['outstanding'] += $cents === null ? 0 : max(0, $cents - ($netByBooking[$id] ?? 0));
        $unmapped += !$units ? 1 : 0;
        // Whole booking category: combination totals are never duplicated over their component rooms.
        $label = $booking['stay_type'] ?: 'Unmapped accommodation';
        if (!isset($accommodations[$label])) $accommodations[$label] = ['name' => $label, 'stays' => 0, 'guests' => 0, 'booked' => 0, 'nights' => 0];
        $accommodations[$label]['stays']++; $accommodations[$label]['guests'] += (int) $booking['guests'];
        $accommodations[$label]['booked'] += $cents ?? 0;
        $accommodations[$label]['nights'] += max(0, (int) ((strtotime($booking['check_out']) - strtotime($booking['check_in'])) / 86400));
        unset($row);
    }
    foreach ($payments as $payment) {
        if ($payment['voided_at'] !== null || !isset($byBooking[(int) $payment['booking_id']]) || !$inside($payment['paid_on'])) continue;
        $key = $payment['kind'] === 'payment' ? 'paid' : 'refunded';
        $rows[substr($payment['paid_on'], 0, 7)][$key] += isset($payment['cents']) ? (int) $payment['cents'] : financeCents($payment['amount']);
    }
    $totals = analyticsEmptyRow('Total');
    foreach ($rows as &$row) {
        $row['net'] = $row['paid'] - $row['refunded'];
        foreach ($totals as $key => $value) if ($key !== 'period') $totals[$key] += $row[$key];
    } unset($row);
    $totals['average_value'] = $totals['priced_bookings'] ? (int) round($totals['booked'] / $totals['priced_bookings']) : null;
    $totals['cancellation_rate'] = $totals['requests'] ? round($totals['cancelled_requests'] / $totals['requests'] * 100, 1) : null;
    $moneyKeys = ['agreed','estimated','booked','pipeline','paid','refunded','net','outstanding','average_value'];
    $format = static function (array $row) use ($moneyKeys): array {
        foreach ($moneyKeys as $key) if (array_key_exists($key, $row) && $row[$key] !== null) $row[$key] = financeDecimal($row[$key]);
        return $row;
    };
    $series = [];
    foreach ($rows as $row) {
        $key = $filters['group'] === 'year' ? substr($row['period'], 0, 4) : $row['period'];
        if (!isset($series[$key])) $series[$key] = analyticsEmptyRow($key);
        foreach ($row as $field => $value) if ($field !== 'period') $series[$key][$field] += $value;
    }
    foreach ($accommodations as &$stay) { $stay['average_nights'] = round($stay['nights'] / $stay['stays'], 1); $stay['booked'] = financeDecimal($stay['booked']); } unset($stay);
    usort($activityCounts, static fn($a, $b) => $b['requests'] <=> $a['requests']);
    return ['filters' => $filters, 'metrics' => $format($totals), 'series' => array_map($format, array_values($series)), 'monthly' => array_map($format, array_values($rows)),
        'status' => $statusCounts, 'sources' => $sourceCounts, 'activities' => array_values($activityCounts), 'accommodations' => array_values($accommodations),
        'unmapped' => $unmapped, 'generated_at' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format(DATE_ATOM)];
}

function analyticsLoad(PDO $db, array $input): array
{
    if (!bookingReportingReady($db)) throw new RuntimeException('Analytics setup is required. Apply the analytics migration and backfill.', 503);
    $db->exec("SET time_zone = '+08:00'");
    $today = analyticsToday();
    $first = (string) ($db->query('SELECT LEAST(MIN(DATE(created_at)),MIN(check_in)) FROM bookings')->fetchColumn() ?: $today);
    $firstPayment = $db->query('SELECT MIN(paid_on) FROM booking_payments WHERE voided_at IS NULL')->fetchColumn();
    if ($firstPayment) $first = min($first, $firstPayment);
    $filters = analyticsFilters($input, $today, min($today, $first));
    $stays = $db->query('SELECT id,name,price,price_mode,price_unit FROM resort_stays ORDER BY sort_order,id')->fetchAll();
    $services = $db->query('SELECT id,name FROM resort_services ORDER BY sort_order,id')->fetchAll();
    foreach (['stay_id' => $stays, 'activity_id' => $services] as $key => $catalog) if ($filters[$key] && !in_array($filters[$key], array_map('intval', array_column($catalog, 'id')), true)) throw new InvalidArgumentException('Selected catalog item does not exist.');
    // Bounded relevant history; no names, contact details, notes or payment references reach this report.
    $db->beginTransaction();
    try {
        $q = $db->prepare('SELECT id,check_in,check_out,guests,stay_id,stay_type,stay_plan_json,status,created_at,agreed_total,estimated_total,booking_source FROM bookings b WHERE (created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)) OR check_in BETWEEN ? AND ? OR EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id=b.id AND p.paid_on BETWEEN ? AND ?) LIMIT 50001');
        $q->execute([$filters['from'],$filters['to'],$filters['from'],$filters['to'],$filters['from'],$filters['to']]);
        $bookings = $q->fetchAll();
        if (count($bookings) > 50000) throw new InvalidArgumentException('Select a shorter period to report on fewer than 50,000 bookings.');
        $payments = []; $activities = [];
        foreach (array_chunk(array_column($bookings, 'id'), 500) as $ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            // Group cash by day and booking in SQL, excluding voids before aggregation.
            $q = $db->prepare("SELECT booking_id,kind,paid_on,SUM(amount*100) cents,NULL voided_at FROM booking_payments WHERE voided_at IS NULL AND booking_id IN ($marks) GROUP BY booking_id,kind,paid_on");
            $q->execute($ids); array_push($payments, ...$q->fetchAll());
            $q = $db->prepare("SELECT booking_id,service_id,service_name FROM booking_activity_requests WHERE booking_id IN ($marks)");
            $q->execute($ids); array_push($activities, ...$q->fetchAll());
        }
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    $report = analyticsReport($bookings, $payments, $activities, $stays, $filters, $today);
    $report['options'] = ['stays' => array_map(static fn($r) => ['id' => (int) $r['id'], 'name' => $r['name']], $stays), 'activities' => array_map(static fn($r) => ['id' => (int) $r['id'], 'name' => $r['name']], $services)];
    return $report;
}
