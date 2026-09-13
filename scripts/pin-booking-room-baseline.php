<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/database.php';
require_once dirname(__DIR__) . '/includes/resort.php';
require_once dirname(__DIR__) . '/includes/booking-rooms.php';

try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1', 'localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') {
        throw new RuntimeException('This command only supports the local project database.');
    }
    $db = database();
    $db->beginTransaction();
    $rows = $db->query('SELECT * FROM bookings ORDER BY id FOR UPDATE')->fetchAll();
    $assignments = bookingRoomAssignments($rows, resortEntities($db, 'stays', true));
    $update = $db->prepare("UPDATE bookings SET room_index = ? WHERE id = ? AND room_index IS NULL AND status IN ('pending', 'confirmed', 'checked_in')");
    $pinned = 0;
    foreach ($rows as $row) {
        if (empty($assignments[$row['id']])) continue;
        $update->execute([$assignments[$row['id']], $row['id']]);
        $pinned += $update->rowCount();
    }
    $before = count($rows);
    $after = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    if ($before !== $after) throw new RuntimeException('Booking row verification failed.');
    $db->commit();
    echo "Pinned $pinned current room positions. Booking rows retained: $after.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, "Could not pin the room baseline. No partial changes were retained.\n");
    exit(1);
}
