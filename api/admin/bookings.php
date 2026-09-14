<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'resort.php';
require_once dirname(__DIR__, 2) . '/includes/booking-rooms.php';

$method = requireMethod('GET', 'PATCH');
requireAdmin();

try {
    $db = database();
    if ($method === 'GET') {
        $statement = $db->query("SELECT b.id, b.reference_code, b.guest_name, b.email, b.phone, b.check_in, b.check_out, b.guests, b.stay_type, b.stay_id, b.service_id, b.service_name, b.message, b.room_index,
            CASE WHEN b.status = 'confirmed' AND b.check_in < CURDATE() THEN 'no_show' ELSE b.status END AS status, b.created_at, b.updated_at,
            EXISTS(SELECT 1 FROM facebook_events e WHERE e.booking_id = b.id AND e.source = 'facebook') AS is_facebook_booking
            FROM bookings b ORDER BY b.created_at DESC");
        $rows = $statement->fetchAll();
        $allocationRows = array_map(static function ($row) { if ($row['status'] === 'no_show') $row['status'] = 'confirmed'; return $row; }, $rows);
        $assignments = bookingRoomAssignments($allocationRows, resortEntities($db, 'stays', true));
        foreach ($rows as &$row) $row['calendar_room'] = $assignments[$row['id']] ?? null;
        unset($row);
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
        jsonResponse([
            'status' => 'success',
            'bookings' => $rows,
            'accommodations' => $accommodations,
            'can_undo_room_move' => !empty($_SESSION['booking_room_undo']),
        ]);
    }

    requireCsrfToken();
    $data = readJsonBody();
    $action = is_string($data['action'] ?? null) ? $data['action'] : '';
    if ($action === 'undo_room_move') {
        $history = $_SESSION['booking_room_undo'] ?? [];
        $undo = is_array($history) ? end($history) : false;
        if (!is_array($undo)) jsonResponse(['message' => 'There are no room moves to undo.'], 409);
        $db->beginTransaction();
        $statement = $db->prepare('SELECT id, reference_code, stay_id, stay_type, room_index, updated_at FROM bookings WHERE id = ? FOR UPDATE');
        $statement->execute([(int) $undo['id']]);
        $booking = $statement->fetch();
        $sameCurrentPosition = $booking
            && (int) ($booking['stay_id'] ?? 0) === (int) ($undo['moved_stay_id'] ?? 0)
            && (int) ($booking['room_index'] ?? 0) === (int) ($undo['moved_room_index'] ?? 0)
            && hash_equals((string) $undo['moved_updated_at'], (string) $booking['updated_at']);
        if (!$sameCurrentPosition) {
            $db->rollBack();
            jsonResponse(['message' => 'This booking changed after the move, so it cannot be safely undone.'], 409);
        }
        $restore = $db->prepare('UPDATE bookings SET stay_id = ?, stay_type = ?, room_index = ?, updated_at = NOW() WHERE id = ?');
        $restore->execute([$undo['stay_id'], $undo['stay_type'], $undo['room_index'], $undo['id']]);
        array_pop($history);
        $restoredAt = $db->prepare('SELECT updated_at FROM bookings WHERE id = ?');
        $restoredAt->execute([$undo['id']]);
        $restoredUpdatedAt = (string) $restoredAt->fetchColumn();
        for ($index = count($history) - 1; $index >= 0; $index--) {
            if ((int) ($history[$index]['id'] ?? 0) !== (int) $undo['id']) continue;
            $history[$index]['moved_updated_at'] = $restoredUpdatedAt;
            break;
        }
        $db->commit();
        $_SESSION['booking_room_undo'] = $history;
        jsonResponse([
            'status' => 'success',
            'reference' => $booking['reference_code'],
            'restored_room' => $undo['room_label'],
            'can_undo_room_move' => !empty($history),
        ]);
    }
    if ($action === 'save_room_moves') {
        $history = $_SESSION['booking_room_undo'] ?? [];
        if (!is_array($history) || $history === []) jsonResponse(['message' => 'There are no room changes to save.'], 409);
        unset($_SESSION['booking_room_undo']);
        jsonResponse([
            'status' => 'success',
            'saved_moves' => count($history),
            'can_undo_room_move' => false,
        ]);
    }
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($action === 'update_dates') {
        $checkInValue = is_string($data['check_in'] ?? null) ? $data['check_in'] : '';
        $checkOutValue = is_string($data['check_out'] ?? null) ? $data['check_out'] : '';
        $expectedUpdatedAt = is_string($data['expected_updated_at'] ?? null) ? $data['expected_updated_at'] : '';
        if (!$id || preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $checkInValue) !== 1 || preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $checkOutValue) !== 1 || $expectedUpdatedAt === '') {
            jsonResponse(['message' => 'Enter valid check-in and check-out dates.'], 422);
        }
        try {
            $timezone = new DateTimeZone('Asia/Manila');
            $checkIn = new DateTimeImmutable($checkInValue . ' 00:00:00', $timezone);
            $checkOut = new DateTimeImmutable($checkOutValue . ' 00:00:00', $timezone);
        } catch (Throwable) {
            jsonResponse(['message' => 'Enter valid check-in and check-out dates.'], 422);
        }
        if ($checkIn->format('Y-m-d') !== $checkInValue || $checkOut->format('Y-m-d') !== $checkOutValue) {
            jsonResponse(['message' => 'Enter valid check-in and check-out dates.'], 422);
        }
        if ($checkOut <= $checkIn) jsonResponse(['message' => 'Check-out must be after check-in.'], 422);
        if ($checkIn->diff($checkOut)->days > 30) jsonResponse(['message' => 'A stay may not exceed 30 nights.'], 422);

        $db->beginTransaction();
        $rows = $db->query('SELECT * FROM bookings ORDER BY id FOR UPDATE')->fetchAll();
        $booking = null;
        foreach ($rows as $row) {
            if ((int) $row['id'] !== $id) continue;
            $booking = $row;
            break;
        }
        $reject = static function (string $message, int $status = 409) use ($db): void { $db->rollBack(); jsonResponse(['message' => $message], $status); };
        if (!$booking) $reject('Booking not found.', 404);
        if (!hash_equals((string) $booking['updated_at'], $expectedUpdatedAt)) $reject('This booking changed. Refresh and try editing the dates again.');

        $stays = resortEntities($db, 'stays', true);
        $originalAssignments = bookingRoomAssignments($rows, $stays);
        $room = $originalAssignments[$id] ?? $booking['room_index'];
        $updatedBooking = array_merge($booking, ['check_in' => $checkInValue, 'check_out' => $checkOutValue]);
        if ($room && in_array($booking['status'], ['pending', 'confirmed', 'checked_in'], true)) {
            foreach ($rows as $other) {
                if ((int) $other['id'] === $id || !in_array($other['status'], ['pending', 'confirmed', 'checked_in'], true)) continue;
                $sameStay = $booking['stay_id']
                    ? (int) $booking['stay_id'] === (int) $other['stay_id']
                    : strcasecmp((string) $booking['stay_type'], (string) $other['stay_type']) === 0;
                if ($sameStay && ($originalAssignments[$other['id']] ?? null) === (int) $room && bookingRoomOverlap($updatedBooking, $other)
                    && ($booking['status'] !== 'pending' || $other['status'] !== 'pending')) {
                    $reject('These dates overlap another active booking in the assigned room. Move the booking or choose different dates.');
                }
            }
        }
        $roomToPersist = in_array($booking['status'], ['pending', 'confirmed', 'checked_in'], true) ? ($room ?: null) : null;
        $statement = $db->prepare('UPDATE bookings SET check_in = ?, check_out = ?, room_index = COALESCE(room_index, ?), updated_at = NOW() WHERE id = ?');
        $statement->execute([$checkInValue, $checkOutValue, $roomToPersist, $id]);
        $db->commit();
        jsonResponse(['status' => 'success', 'reference' => $booking['reference_code']]);
    }
    if ($action === 'move_room') {
        $stayId = filter_var($data['stay_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $room = filter_var($data['room_index'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
        if (!$id || !$stayId || !$room) jsonResponse(['message' => 'Choose a valid booking and room.'], 422);
        $db->beginTransaction();
        $rows = $db->query('SELECT * FROM bookings ORDER BY id FOR UPDATE')->fetchAll();
        $stays = resortEntities($db, 'stays', true);
        $booking = null; $stay = null;
        foreach ($rows as $row) if ((int) $row['id'] === $id) $booking = $row;
        foreach ($stays as $candidate) if ((int) $candidate['id'] === $stayId) $stay = $candidate;
        $reject = static function (string $message) use ($db): void { $db->rollBack(); jsonResponse(['message' => $message], 409); };
        if (!$booking || !$stay || !$stay['enabled'] || $stay['archived']) $reject('The booking or accommodation is no longer available.');
        if (!in_array($booking['status'], ['pending', 'confirmed', 'checked_in'], true)) $reject('Only active bookings can be moved.');
        if ($room > ($stay['style'] === 'exclusive' ? 1 : (int) $stay['room_count'])) $reject('That room does not exist.');
        if ((string) ($data['expected_updated_at'] ?? '') !== $booking['updated_at']) $reject('This booking changed. Refresh and try the move again.');
        $assignments = bookingRoomAssignments($rows, $stays);
        $currentRoom = $assignments[$id] ?? $booking['room_index'];
        $currentLabel = preg_match('/room\z/i', (string) $booking['stay_type']) && $currentRoom
            ? (string) $booking['stay_type'] . ' #' . (string) $currentRoom
            : (string) $booking['stay_type'];
        $targetLabel = preg_match('/room\z/i', (string) $stay['name'])
            ? (string) $stay['name'] . ' #' . (string) $room
            : (string) $stay['name'];
        $warnings = [sprintf('This will move the booking from %s to %s.', $currentLabel ?: 'its current room', $targetLabel)];
        if ((int) $booking['guests'] > (int) $stay['max_guests']) {
            $warnings[] = sprintf(
                '%s is configured for up to %d pax, while this booking has %d pax.',
                $stay['name'],
                (int) $stay['max_guests'],
                (int) $booking['guests']
            );
        }
        if (($data['confirm_warnings'] ?? false) !== true) {
            $db->rollBack();
            jsonResponse([
                'status' => 'warning',
                'message' => 'Review the room move warning before continuing.',
                'requires_confirmation' => true,
                'can_proceed' => true,
                'warnings' => $warnings,
            ], 409);
        }
        foreach ($rows as $other) {
            if ((int) $other['id'] === $id || !in_array($other['status'], ['pending', 'confirmed', 'checked_in'], true)) continue;
            $sameStay = (int) $other['stay_id'] === $stayId || (!$other['stay_id'] && strcasecmp((string) $other['stay_type'], $stay['name']) === 0);
            if ($sameStay && ($assignments[$other['id']] ?? null) === $room && bookingRoomOverlap($booking, $other)
                && ($booking['status'] !== 'pending' || $other['status'] !== 'pending')) $reject('This room overlaps an active booking. Choose another room.');
        }
        // Freeze existing displayed positions so accepting one move never shifts other cards.
        $pin = $db->prepare('UPDATE bookings SET room_index = ? WHERE id = ? AND room_index IS NULL');
        foreach ($rows as $row) if (!empty($assignments[$row['id']]) && in_array($row['status'], ['pending', 'confirmed', 'checked_in'], true)) $pin->execute([$assignments[$row['id']], $row['id']]);
        $move = $db->prepare('UPDATE bookings SET stay_id = ?, stay_type = ?, room_index = ?, updated_at = NOW() WHERE id = ?');
        $move->execute([$stayId, $stay['name'], $room, $id]);
        $updatedAt = $db->prepare('SELECT updated_at FROM bookings WHERE id = ?');
        $updatedAt->execute([$id]);
        $history = is_array($_SESSION['booking_room_undo'] ?? null) ? $_SESSION['booking_room_undo'] : [];
        $history[] = [
            'id' => $id,
            'stay_id' => $booking['stay_id'],
            'stay_type' => $booking['stay_type'],
            'room_index' => $assignments[$id] ?? $booking['room_index'],
            'room_label' => preg_match('/room\z/i', (string) $booking['stay_type'])
                ? (string) $booking['stay_type'] . ' #' . (string) ($assignments[$id] ?? $booking['room_index'])
                : (string) $booking['stay_type'],
            'moved_stay_id' => $stayId,
            'moved_room_index' => $room,
            'moved_updated_at' => (string) $updatedAt->fetchColumn(),
        ];
        $db->commit();
        $_SESSION['booking_room_undo'] = array_slice($history, -50);
        jsonResponse(['status' => 'success', 'reference' => $booking['reference_code'], 'can_undo_room_move' => true]);
    }
    $status = is_string($data['status'] ?? null) ? $data['status'] : '';
    $allowed = ['confirmed', 'checked_in', 'completed', 'cancelled'];
    if ($id === false || !in_array($status, $allowed, true)) {
        jsonResponse(['status' => 'error', 'message' => 'The booking update is invalid.'], 422);
    }

    $db->beginTransaction();
    $rows = $db->query('SELECT * FROM bookings ORDER BY id FOR UPDATE')->fetchAll();
    $booking = null;
    foreach ($rows as $row) if ((int) $row['id'] === $id) $booking = $row;
    if (!$booking) {
        $db->rollBack();
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
        $db->rollBack();
        jsonResponse(['status' => 'error', 'message' => 'This booking status cannot skip or repeat a processing step. Refresh the page and try again.'], 409);
    }

    $assignments = bookingRoomAssignments($rows, resortEntities($db, 'stays', true));
    if (in_array($status, ['confirmed', 'checked_in'], true)) {
        $room = $assignments[$id] ?? null;
        if (!$room) { $db->rollBack(); jsonResponse(['message' => 'Assign this booking to an available room first.'], 409); }
        foreach ($rows as $other) {
            $sameStay = $booking['stay_id'] ? (int) $booking['stay_id'] === (int) $other['stay_id'] : strcasecmp((string) $booking['stay_type'], (string) $other['stay_type']) === 0;
            if ((int) $other['id'] !== $id && $sameStay && ($assignments[$other['id']] ?? null) === $room
                && in_array($other['status'], ['confirmed', 'checked_in'], true) && bookingRoomOverlap($booking, $other)) {
                $db->rollBack(); jsonResponse(['message' => 'This room already has a confirmed or checked-in booking for these dates. Move the request to an available room first.'], 409);
            }
        }
    }
    $pin = $db->prepare('UPDATE bookings SET room_index = ? WHERE id = ? AND room_index IS NULL');
    foreach ($rows as $row) if (!empty($assignments[$row['id']]) && in_array($row['status'], ['pending', 'confirmed', 'checked_in'], true)) $pin->execute([$assignments[$row['id']], $row['id']]);
    $statement = $db->prepare('UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?');
    $statement->execute([$status, $id, $currentStatus]);
    if ($statement->rowCount() !== 1) {
        $db->rollBack();
        jsonResponse(['status' => 'error', 'message' => 'This booking changed while you were viewing it. Refresh the page and try again.'], 409);
    }
    $db->commit();
    jsonResponse(['status' => 'success', 'reference' => $booking['reference_code']]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('Admin booking operation failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'The booking operation is temporarily unavailable.'], 500);
}
