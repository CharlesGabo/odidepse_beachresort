<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/bookings/booking-finance.php';
$method = requireMethod('GET', 'POST');
$actor = requireAdmin();
try {
    if ($method === 'POST') requireCsrfToken();
    $data = $method === 'GET' ? $_GET : readJsonBody();
    $id = filter_var($data['booking_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id) throw new InvalidArgumentException('Choose a booking.');
    $db = database();
    if ($method === 'POST') financeMutate($db, $id, (int) $actor['id'], $data);
    $db->beginTransaction();
    $snapshot = financeSnapshot($db, $id);
    $db->commit();
    jsonResponse(['status' => 'success', 'finance' => $snapshot]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if (!($error instanceof InvalidArgumentException) && !($error instanceof OutOfBoundsException) && $error->getCode() !== 409) error_log('Booking finance failed: ' . $error->getMessage());
    $code = $error instanceof InvalidArgumentException ? 422 : ($error instanceof OutOfBoundsException ? 404 : ($error->getCode() === 409 ? 409 : 503));
    jsonResponse(['message' => $code === 503 ? 'Finance is unavailable. Check that analytics setup is complete.' : $error->getMessage()], $code);
}
