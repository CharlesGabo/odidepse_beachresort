<?php
declare(strict_types=1);

function bookingRoomOverlap(array $a, array $b): bool
{
    // Older bookings may not have stored times. Use the booking form's normal
    // arrival and departure defaults so a same-day room turnover stays valid.
    $time = static function (array $booking, string $label, string $fallback): string {
        return preg_match('/Preferred ' . $label . ':\s*(\d{2}:\d{2})/i', (string) ($booking['message'] ?? ''), $m) ? $m[1] : $fallback;
    };
    return $a['check_in'] . ' ' . $time($a, 'arrival', '14:00') < $b['check_out'] . ' ' . $time($b, 'departure', '12:00')
        && $b['check_in'] . ' ' . $time($b, 'arrival', '14:00') < $a['check_out'] . ' ' . $time($a, 'departure', '12:00');
}

function bookingRoomAssignments(array $bookings, array $stays): array
{
    $assigned = [];
    foreach ($stays as $stay) {
        $count = $stay['style'] === 'exclusive' ? 1 : max(1, (int) $stay['room_count']);
        $rows = array_values(array_filter($bookings, static fn($b) => (int) $b['stay_id'] === (int) $stay['id'] || (!$b['stay_id'] && strcasecmp((string) $b['stay_type'], $stay['name']) === 0)));
        usort($rows, static function ($a, $b) {
            $rank = static fn($b) => !empty($b['room_index']) ? 0 : (in_array($b['status'], ['confirmed', 'checked_in'], true) ? 1 : 2);
            return $rank($a) <=> $rank($b) ?: strcmp($a['created_at'], $b['created_at']) ?: (int) $a['id'] <=> (int) $b['id'];
        });
        $units = array_fill(1, $count, []);
        foreach ($rows as $row) {
            if (!in_array($row['status'], ['pending', 'confirmed', 'checked_in'], true)) {
                $assigned[$row['id']] = (int) ($row['room_index'] ?? 1);
                continue;
            }
            $room = (int) ($row['room_index'] ?? 0);
            if ($room < 1 || $room > $count) {
                $room = 0;
                $eligible = [];
                foreach ($units as $index => $occupants) {
                    $overlaps = array_filter($occupants, static fn($other) => bookingRoomOverlap($row, $other));
                    $blocked = array_filter($overlaps, static fn($other) => $row['status'] !== 'pending' || $other['status'] !== 'pending');
                    if (!$blocked) $eligible[$index] = $overlaps;
                }
                // Keep competing requests grouped until an administrator accepts a move.
                if ($row['status'] === 'pending') foreach ($eligible as $index => $overlaps) if ($overlaps) { $room = $index; break; }
                if (!$room && $eligible) $room = (int) array_key_first($eligible);
            }
            $assigned[$row['id']] = $room ?: null;
            if ($room) $units[$room][] = $row;
        }
    }
    return $assigned;
}
