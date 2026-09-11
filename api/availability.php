<?php

declare(strict_types=1);

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'api.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';

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
        || $checkIn->diff($checkOut)->days > 30
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
        "SELECT check_in, check_out, status
         FROM bookings
         WHERE stay_id = ?
           AND status IN ('pending', 'confirmed', 'checked_in')
           AND check_in < ?
           AND check_out > ?"
    );
    $bookingQuery->execute([$stayId, $checkOutValue, $checkInValue]);
    $bookings = $bookingQuery->fetchAll();

    $minimumAvailable = $capacity;
    $peakOccupied = 0;
    $peakPending = 0;
    for ($date = $checkIn; $date < $checkOut; $date = $date->modify('+1 day')) {
        $key = $date->format('Y-m-d');
        $occupied = 0;
        $pending = 0;
        foreach ($bookings as $booking) {
            if ($booking['check_in'] <= $key && $booking['check_out'] > $key) {
                if ($booking['status'] === 'pending') $pending++;
                else $occupied++;
            }
        }
        $peakOccupied = max($peakOccupied, $occupied);
        $peakPending = max($peakPending, $pending);
        $minimumAvailable = min($minimumAvailable, max(0, $capacity - $occupied - $pending));
    }

    jsonResponse([
        'status' => 'success',
        'stay_id' => (int) $stay['id'],
        'stay_name' => $stay['name'],
        'capacity' => $capacity,
        'occupied' => $peakOccupied,
        'pending' => $peakPending,
        'available' => $minimumAvailable,
        'check_in' => $checkInValue,
        'check_out' => $checkOutValue,
    ]);
} catch (Throwable $error) {
    error_log('Availability lookup failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'Availability could not be checked right now.'], 503);
}
