<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'resort.php';

$method = requireMethod('GET', 'PATCH');
requireAdmin();

try {
    $db = database();
    if ($method === 'GET') {
        $statement = $db->query('SELECT id, reference_code, guest_name, email, phone, check_in, check_out, guests, stay_type, stay_id, service_id, service_name, message, status, created_at FROM bookings ORDER BY created_at DESC LIMIT 250');
        $accommodations = array_map(
            static fn(array $stay): array => [
                'id' => $stay['id'],
                'name' => $stay['name'],
                'room_count' => $stay['room_count'],
                'style' => $stay['style'],
                'enabled' => $stay['enabled'],
                'archived' => $stay['archived'],
            ],
            resortEntities($db, 'stays', true)
        );
        jsonResponse(['status' => 'success', 'bookings' => $statement->fetchAll(), 'accommodations' => $accommodations]);
    }

    requireCsrfToken();
    $data = readJsonBody();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $status = is_string($data['status'] ?? null) ? $data['status'] : '';
    $allowed = ['confirmed', 'checked_in', 'completed', 'cancelled'];
    if ($id === false || !in_array($status, $allowed, true)) {
        jsonResponse(['status' => 'error', 'message' => 'The booking update is invalid.'], 422);
    }

    $bookingStatement = $db->prepare('SELECT reference_code, status FROM bookings WHERE id = ?');
    $bookingStatement->execute([$id]);
    $booking = $bookingStatement->fetch();
    if (!$booking) {
        jsonResponse(['status' => 'error', 'message' => 'Booking not found.'], 404);
    }

    $transitions = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['checked_in'],
        'checked_in' => ['completed'],
        'completed' => [],
        'cancelled' => [],
    ];
    $currentStatus = (string) $booking['status'];
    if (!in_array($status, $transitions[$currentStatus] ?? [], true)) {
        jsonResponse(['status' => 'error', 'message' => 'This booking status cannot skip or repeat a processing step. Refresh the page and try again.'], 409);
    }

    $statement = $db->prepare('UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?');
    $statement->execute([$status, $id, $currentStatus]);
    if ($statement->rowCount() !== 1) {
        jsonResponse(['status' => 'error', 'message' => 'This booking changed while you were viewing it. Refresh the page and try again.'], 409);
    }
    jsonResponse(['status' => 'success', 'reference' => $booking['reference_code']]);
} catch (Throwable $error) {
    error_log('Admin booking operation failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'The booking operation is temporarily unavailable.'], 500);
}
