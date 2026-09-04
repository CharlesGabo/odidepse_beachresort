<?php

declare(strict_types=1);

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'api.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';

requireMethod('POST');
$data = readJsonBody();

$name = cleanText($data['guest_name'] ?? null, 100);
$email = cleanText($data['email'] ?? null, 190);
$phone = cleanText($data['phone'] ?? null, 30);
$stayType = cleanText($data['stay_type'] ?? '', 50);
$message = cleanText($data['message'] ?? '', 1000);
$guests = filter_var($data['guests'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 8]]);
$allowedStays = ['', 'Dagat Casita', 'Puno Villa', 'Exclusive resort buyout'];

$errors = [];
if (mb_strlen($name) < 2) $errors['guest_name'] = 'Enter your full name.';
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) $errors['email'] = 'Enter a valid email address.';
if (preg_match('/\A[0-9+()\-\s]{7,30}\z/', $phone) !== 1) $errors['phone'] = 'Enter a valid mobile number.';
if ($guests === false) $errors['guests'] = 'Guests must be between 1 and 8.';
if (!in_array($stayType, $allowedStays, true)) $errors['stay_type'] = 'Choose a valid stay type.';

try {
    $checkIn = new DateTimeImmutable((string) ($data['check_in'] ?? ''), new DateTimeZone('Asia/Manila'));
    $checkOut = new DateTimeImmutable((string) ($data['check_out'] ?? ''), new DateTimeZone('Asia/Manila'));
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    if ($checkIn <= $today) $errors['check_in'] = 'Check-in must be a future date.';
    if ($checkOut <= $checkIn) $errors['check_out'] = 'Check-out must be after check-in.';
    if ($checkIn->diff($checkOut)->days > 30) $errors['check_out'] = 'A stay may not exceed 30 nights.';
    if ($checkIn->format('Y-m-d') !== (string) ($data['check_in'] ?? '') || $checkOut->format('Y-m-d') !== (string) ($data['check_out'] ?? '')) throw new Exception();
} catch (Throwable) {
    $errors['dates'] = 'Enter valid check-in and check-out dates.';
}

if ($errors !== []) {
    jsonResponse(['status' => 'error', 'message' => 'Please check the highlighted booking details.', 'errors' => $errors], 422);
}

try {
    $db = database();
    $identifier = clientIdentifier('booking');
    $count = $db->prepare('SELECT COUNT(*) FROM request_attempts WHERE identifier_hash = ? AND attempted_at >= (NOW() - INTERVAL 1 HOUR)');
    $count->execute([$identifier]);
    if ((int) $count->fetchColumn() >= 5) {
        jsonResponse(['status' => 'error', 'message' => 'Too many booking requests were sent. Please try again later.'], 429);
    }

    $db->beginTransaction();
    $db->prepare('INSERT INTO request_attempts (identifier_hash, attempted_at) VALUES (?, NOW())')->execute([$identifier]);
    $reference = 'OD-' . date('ym') . '-' . strtoupper(bin2hex(random_bytes(3)));
    $statement = $db->prepare('INSERT INTO bookings (reference_code, guest_name, email, phone, check_in, check_out, guests, stay_type, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\')');
    $statement->execute([$reference, $name, strtolower($email), $phone, $checkIn->format('Y-m-d'), $checkOut->format('Y-m-d'), $guests, $stayType ?: null, $message ?: null]);
    $db->commit();
    jsonResponse(['status' => 'success', 'reference' => $reference], 201);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('Booking request failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'We could not save your request right now. Please try again shortly.'], 500);
}
