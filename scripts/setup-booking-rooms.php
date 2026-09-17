<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/includes/shared/database.php';
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1', 'localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local database only.');
    $db = database();
    $before = $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $db->exec(file_get_contents(dirname(__DIR__) . '/database/migrations/011_booking_room_assignment.sql'));
    $after = $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $column = $db->query("SHOW COLUMNS FROM bookings LIKE 'room_index'")->fetch();
    if (!$column || $before !== $after) throw new RuntimeException('Verification failed.');
    echo "Room assignment column ready. Booking rows before/after: $before/$after.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Room setup failed. Check local database availability and migration privileges. Code: ' . $error->getCode() . "\n");
    exit(1);
}
