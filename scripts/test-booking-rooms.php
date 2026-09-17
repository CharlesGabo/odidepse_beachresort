<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bookings/booking-rooms.php';
$stay = ['id' => 1, 'name' => '8-guest room', 'room_count' => 3, 'style' => 'room'];
$row = ['id' => 1, 'stay_id' => 1, 'stay_type' => $stay['name'], 'status' => 'pending', 'room_index' => null, 'check_in' => '2026-09-15', 'check_out' => '2026-09-20', 'created_at' => '2026-09-01', 'message' => ''];
$rows = [array_replace($row, ['id' => 1, 'status' => 'checked_in', 'room_index' => 1]), array_replace($row, ['id' => 2, 'room_index' => 2]), array_replace($row, ['id' => 3, 'room_index' => 2]), array_replace($row, ['id' => 4, 'room_index' => 3, 'status' => 'completed'])];
$assignments = bookingRoomAssignments($rows, [$stay]);
if ($assignments[2] !== 2 || $assignments[3] !== 2) throw new RuntimeException('Pinned pending requests moved unexpectedly.');
$rows[] = array_replace($row, ['id' => 5, 'status' => 'confirmed']);
$assignments = bookingRoomAssignments($rows, [$stay]);
if ($assignments[5] !== 3) throw new RuntimeException('Completed room must be reusable without displacing pinned requests.');
$a = array_replace($row, ['check_out' => '2026-09-16', 'message' => 'Preferred departure: 11:00']);
$b = array_replace($row, ['check_in' => '2026-09-16', 'message' => 'Preferred arrival: 14:00']);
if (bookingRoomOverlap($a, $b)) throw new RuntimeException('Non-overlapping boundary times rejected.');
if (!bookingRoomOverlap($row, $row)) throw new RuntimeException('Overlapping dates missed.');
echo "Passed room assignment, completed-room reuse, pinned requests and time overlap checks.\n";
if (in_array('--database', $argv ?? [], true)) {
    require_once dirname(__DIR__) . '/includes/shared/database.php';
    require_once dirname(__DIR__) . '/includes/resort/resort.php';
    $db = database();
    $rows = $db->query('SELECT id, stay_id, stay_type, status, room_index, check_in, check_out, created_at, message FROM bookings')->fetchAll();
    $assignments = bookingRoomAssignments($rows, resortEntities($db, 'stays', true));
    echo 'Local application account read ' . count($rows) . ' bookings and calculated ' . count($assignments) . " room positions. No records changed.\n";
}
