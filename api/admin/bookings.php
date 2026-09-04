<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';

$method = requireMethod('GET', 'PATCH');
requireAdmin();

try {
    $db = database();
    if ($method === 'GET') {
        $statement = $db->query('SELECT id, reference_code, guest_name, email, phone, check_in, check_out, guests, stay_type, message, status, created_at FROM bookings ORDER BY created_at DESC LIMIT 250');
        jsonResponse(['status' => 'success', 'bookings' => $statement->fetchAll()]);
    }

    requireCsrfToken();
    $data = readJsonBody();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $status = is_string($data['status'] ?? null) ? $data['status'] : '';
    $allowed = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'];
    if ($id === false || !in_array($status, $allowed, true)) {
        jsonResponse(['status' => 'error', 'message' => 'The booking update is invalid.'], 422);
    }

    $statement = $db->prepare('UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?');
    $statement->execute([$status, $id]);
    if ($statement->rowCount() === 0) {
        $exists = $db->prepare('SELECT reference_code FROM bookings WHERE id = ?');
        $exists->execute([$id]);
        $reference = $exists->fetchColumn();
        if ($reference === false) jsonResponse(['status' => 'error', 'message' => 'Booking not found.'], 404);
    } else {
        $referenceStatement = $db->prepare('SELECT reference_code FROM bookings WHERE id = ?');
        $referenceStatement->execute([$id]);
        $reference = $referenceStatement->fetchColumn();
    }
    jsonResponse(['status' => 'success', 'reference' => $reference]);
} catch (Throwable $error) {
    error_log('Admin booking operation failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'The booking operation is temporarily unavailable.'], 500);
}
