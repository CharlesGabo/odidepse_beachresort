<?php
declare(strict_types=1);
// Additive rollout: old booking flows stay available before migration 013 is applied.
function analyticsSchemaReady(PDO $db): bool
{
    static $ready = null;
    return $ready ??= (bool) $db->query("SHOW COLUMNS FROM bookings LIKE 'agreed_total'")->fetch();
}

function bookingRecordSource(PDO $db, int $id, string $source): void
{
    if (analyticsSchemaReady($db)) $db->prepare('UPDATE bookings SET booking_source = ? WHERE id = ?')->execute([$source, $id]);
}
