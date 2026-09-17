<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/shared/api.php';
require_once dirname(__DIR__) . '/includes/shared/database.php';

requireMethod('GET');

$stayId = filter_var($_GET['stay_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$checkInValue = is_string($_GET['check_in'] ?? null) ? $_GET['check_in'] : '';
$checkOutValue = is_string($_GET['check_out'] ?? null) ? $_GET['check_out'] : '';

try {
    $timezone = new DateTimeZone('Asia/Manila');
    $checkIn = new DateTimeImmutable($checkInValue, $timezone);
    $checkOut = new DateTimeImmutable($checkOutValue, $timezone);
    if (
        $stayId === false
        || $checkIn->format('Y-m-d') !== $checkInValue
        || $checkOut->format('Y-m-d') !== $checkOutValue
        || $checkOut <= $checkIn
        || $checkIn->diff($checkOut)->days > 62
    ) {
        throw new InvalidArgumentException();
    }
} catch (Throwable) {
    jsonResponse(['status' => 'error', 'message' => 'Choose a valid stay and date range.'], 422);
}

try {
    $db = database();
    $stayQuery = $db->prepare('SELECT id, name, details FROM resort_stays WHERE id = ? AND enabled = 1 AND archived = 0 LIMIT 1');
    $stayQuery->execute([$stayId]);
    $stay = $stayQuery->fetch();
    if (!$stay) {
        jsonResponse(['status' => 'error', 'message' => 'This accommodation is no longer available.'], 404);
    }

    $details = json_decode($stay['details'], true, 32, JSON_THROW_ON_ERROR);
    $configuredCount = (int) ($details['room_count'] ?? 0);
    $capacity = ($details['style'] ?? '') === 'exclusive' ? 1 : max(1, $configuredCount);

    $bookingQuery = $db->prepare(
        "SELECT stay_id, stay_type, stay_plan_json, check_in, check_out, status
         FROM bookings
         WHERE status IN ('pending', 'confirmed', 'checked_in')
           AND check_in < ?
           AND check_out > ?"
    );
    $bookingQuery->execute([$checkOutValue, $checkInValue]);
    $bookings = $bookingQuery->fetchAll();

    $minimumAvailable = $capacity;
    $peakOccupied = 0;
    $peakPending = 0;
    $days = [];
    for ($date = $checkIn; $date < $checkOut; $date = $date->modify('+1 day')) {
        $key = $date->format('Y-m-d');
        $occupied = 0;
        $pending = 0;
        foreach ($bookings as $booking) {
            if ($booking['check_in'] <= $key && $booking['check_out'] > $key) {
                $units = 0;
                $plan = json_decode((string) ($booking['stay_plan_json'] ?? ''), true);
                if (is_array($plan)) {
                    foreach ($plan as $component) if ((int) ($component['stay_id'] ?? 0) === $stayId) $units += max(0, (int) ($component['quantity'] ?? 0));
                } elseif ((int) ($booking['stay_id'] ?? 0) === $stayId || ($booking['stay_id'] === null && $booking['stay_type'] === $stay['name'])) {
                    $units = 1;
                }
                if ($booking['status'] === 'pending') $pending += $units;
                else $occupied += $units;
            }
        }
        $peakOccupied = max($peakOccupied, $occupied);
        $peakPending = max($peakPending, $pending);
        $minimumAvailable = min($minimumAvailable, max(0, $capacity - $occupied));
        $days[$key] = max(0, $capacity - $occupied);
    }

    jsonResponse([
        'status' => 'success',
        'stay_id' => (int) $stay['id'],
        'stay_name' => $stay['name'],
        'capacity' => $capacity,
        'occupied' => $peakOccupied,
        'pending' => $peakPending,
        'available' => $minimumAvailable,
        'days' => $days,
        'check_in' => $checkInValue,
        'check_out' => $checkOutValue,
    ]);
} catch (Throwable $error) {
    error_log('Availability lookup failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'Availability could not be checked right now.'], 503);
}
