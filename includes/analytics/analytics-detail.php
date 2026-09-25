<?php
declare(strict_types=1);
require_once __DIR__ . '/analytics.php';

/** Booking-level provenance for one KPI. Only the authenticated detail endpoint calls this. */
function analyticsDetailRows(array $data, string $metric): array
{
    $allowed = ['booked','net','outstanding','pipeline','requests','guests','average','cancelled'];
    if (!in_array($metric, $allowed, true)) throw new InvalidArgumentException('Choose a valid metric.');
    ['bookings' => $bookings, 'payments' => $payments, 'activities' => $activities, 'stays' => $stays, 'filters' => $filters, 'today' => $today] = $data;
    $inside = static fn(string $date): bool => $date >= $filters['from'] && $date <= $filters['to'];
    $activityIds = []; $netByBooking = [];
    foreach ($activities as $activity) $activityIds[(int) $activity['booking_id']][(int) $activity['service_id']] = true;
    foreach ($payments as $payment) {
        if ($payment['voided_at'] !== null || $payment['paid_on'] > min($today, $filters['to'])) continue;
        $id = (int) $payment['booking_id'];
        $cents = isset($payment['cents']) ? (int) $payment['cents'] : financeCents($payment['amount']);
        $netByBooking[$id] = ($netByBooking[$id] ?? 0) + ($payment['kind'] === 'payment' ? $cents : -$cents);
    }
    $matched = [];
    foreach ($bookings as $booking) {
        $id = (int) $booking['id'];
        $status = $booking['status'] === 'confirmed' && $booking['check_in'] < $today ? 'no_show' : $booking['status'];
        if (($filters['source'] !== 'all' && $booking['booking_source'] !== $filters['source'])
            || ($filters['status'] !== 'all' && $status !== $filters['status'])
            || ($filters['stay_id'] && !isset(bookingReportingUnits($booking, $stays)[$filters['stay_id']]))
            || ($filters['activity_id'] && !isset($activityIds[$id][$filters['activity_id']]))) continue;
        $booking['report_status'] = $status;
        $matched[$id] = $booking;
    }
    $rows = [];
    if ($metric === 'net') {
        foreach ($payments as $payment) {
            $booking = $matched[(int) $payment['booking_id']] ?? null;
            if (!$booking || $payment['voided_at'] !== null || !$inside($payment['paid_on'])) continue;
            $cents = isset($payment['cents']) ? (int) $payment['cents'] : financeCents($payment['amount']);
            $rows[] = analyticsDetailRow($booking, $payment['paid_on'], financeDecimal(($payment['kind'] === 'payment' ? 1 : -1) * $cents), $payment['kind'] === 'payment' ? 'Payment' : 'Refund');
        }
    } else foreach ($matched as $booking) {
        $created = substr($booking['created_at'], 0, 10);
        $checkIn = $booking['check_in'];
        $status = $booking['report_status'];
        $accepted = in_array($status, ['confirmed','checked_in','completed'], true);
        $price = $booking['agreed_total'] ?? $booking['estimated_total'];
        $cents = $price === null ? null : financeCents($price);
        $basis = $booking['agreed_total'] !== null ? 'Agreed price' : 'Room estimate';
        if ($metric === 'requests' && $inside($created)) $rows[] = analyticsDetailRow($booking, $created, 1, 'Request created');
        if ($metric === 'cancelled' && $inside($created)) $rows[] = analyticsDetailRow($booking, $created, $status === 'cancelled' ? 1 : 0, $status === 'cancelled' ? 'Cancelled' : 'Not cancelled');
        if (!$inside($checkIn)) continue;
        if ($metric === 'pipeline' && $status === 'pending') $rows[] = analyticsDetailRow($booking, $checkIn, financeDecimal($cents ?? 0), $cents === null ? 'Unpriced booking' : $basis);
        if (!$accepted) continue;
        if ($metric === 'guests') $rows[] = analyticsDetailRow($booking, $checkIn, (int) $booking['guests'], 'Guests in party');
        if (($metric === 'booked' || $metric === 'average') && $cents !== null) $rows[] = analyticsDetailRow($booking, $checkIn, financeDecimal($cents), $basis);
        if ($metric === 'outstanding' && $cents !== null) {
            $due = max(0, $cents - ($netByBooking[(int) $booking['id']] ?? 0));
            if ($due > 0) $rows[] = analyticsDetailRow($booking, $checkIn, financeDecimal($due), $basis);
        }
    }
    usort($rows, static fn($a, $b) => strcmp($b['date'], $a['date']) ?: strcmp($b['reference'], $a['reference']));
    return $rows;
}

function analyticsDetailRow(array $booking, string $date, int|string $contribution, string $basis): array
{
    return ['booking_id' => (int) $booking['id'], 'reference' => $booking['reference_code'], 'guest' => $booking['guest_name'],
        'stay' => $booking['stay_type'], 'status' => $booking['report_status'], 'date' => $date,
        'contribution' => $contribution, 'basis' => $basis];
}

function analyticsLoadDetail(PDO $db, array $input): array
{
    $metric = $input['metric'] ?? null;
    if (!is_string($metric) || !in_array($metric, ['booked','net','outstanding','pipeline','requests','guests','average','cancelled'], true)) throw new InvalidArgumentException('Choose a valid metric.');
    $page = filter_var($input['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
    if ($page === false) throw new InvalidArgumentException('Choose a valid results page.');
    $data = analyticsLoadData($db, $input, true);
    $rows = analyticsDetailRows($data, $metric);
    $report = analyticsReport($data['bookings'], $data['payments'], $data['activities'], $data['stays'], $data['filters'], $data['today']);
    $metricField = ['average' => 'average_value', 'cancelled' => 'cancellation_rate'][$metric] ?? $metric;
    $pageSize = 25;
    return ['metric' => $metric, 'value' => $report['metrics'][$metricField], 'total_rows' => count($rows), 'page' => $page,
        'page_size' => $pageSize, 'rows' => array_slice($rows, ($page - 1) * $pageSize, $pageSize)];
}
