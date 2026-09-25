<?php
declare(strict_types=1);
require_once __DIR__ . '/booking-finance.php';

function bookingReportingReady(PDO $db): bool
{
    static $ready = null;
    if ($ready === null) $ready = (bool) $db->query("SHOW COLUMNS FROM bookings LIKE 'estimate_recorded_at'")->fetch()
        && (int) $db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('booking_payments','booking_finance_audit','booking_activity_requests')")->fetchColumn() === 3;
    return $ready;
}

function bookingReportingUnits(array $booking, array $stays): array
{
    $plan = json_decode((string) ($booking['stay_plan_json'] ?? ''), true);
    $units = [];
    if (is_array($plan) && $plan !== []) {
        foreach ($plan as $part) {
            $id = (int) ($part['stay_id'] ?? 0); $quantity = (int) ($part['quantity'] ?? 0);
            if (!$id || $quantity < 1 || $quantity > 1000) return [];
            $units[$id] = ($units[$id] ?? 0) + $quantity;
        }
    } elseif (!empty($booking['stay_id'])) $units[(int) $booking['stay_id']] = 1;
    else foreach ($stays as $stay) if (strcasecmp(trim((string) ($booking['stay_type'] ?? '')), $stay['name']) === 0) { $units[(int) $stay['id']] = 1; break; }
    return $units;
}

function bookingReportingEstimate(array $booking, array $stays): array
{
    $in = DateTimeImmutable::createFromFormat('!Y-m-d', $booking['check_in']);
    $out = DateTimeImmutable::createFromFormat('!Y-m-d', $booking['check_out']);
    $units = bookingReportingUnits($booking, $stays);
    if (!$in || !$out || $in->format('Y-m-d') !== $booking['check_in'] || $out->format('Y-m-d') !== $booking['check_out'] || $out <= $in || !$units) return [null, 'Accommodation or dates could not be matched.'];
    $catalog = array_column($stays, null, 'id'); $cents = 0; $parts = []; $from = false;
    foreach ($units as $id => $quantity) {
        $stay = $catalog[$id] ?? null;
        if (!$stay || $stay['price'] === null || !in_array(strtolower(trim($stay['price_unit'])), ['night', 'per night'], true)) return [null, 'A nightly catalog rate is missing.'];
        $cents += financeCents((string) $stay['price']) * $quantity;
        $parts[] = $quantity . ' × ' . $stay['name'] . ' at PHP ' . $stay['price'];
        $from = $from || $stay['price_mode'] === 'from';
    }
    $nights = $in->diff($out)->days;
    if ($cents * $nights > 999999999999) return [null, 'Estimate exceeds the supported amount.'];
    return [financeDecimal($cents * $nights), mb_substr($booking['check_in'] . ' to ' . $booking['check_out'] . ': ' . ($from ? 'Starting-rate estimate. ' : '') . implode('; ', $parts) . ' / night × ' . $nights . ' nights. Room-only catalog snapshot; excludes activities.', 0, 1000)];
}

/** Called within the booking write transaction; never accepts a browser-provided price. */
function bookingReportingCapture(PDO $db, int $id, ?string $source = null, ?array $activityIds = null): void
{
    if (!bookingReportingReady($db)) return;
    $q = $db->prepare('SELECT * FROM bookings WHERE id = ?'); $q->execute([$id]); $booking = $q->fetch();
    if (!$booking) throw new RuntimeException('Booking missing.');
    if ($booking['estimate_recorded_at'] === null) {
        [$total, $basis] = bookingReportingEstimate($booking, $db->query('SELECT id,name,price,price_unit,price_mode FROM resort_stays')->fetchAll());
        $db->prepare('UPDATE bookings SET estimated_total=?,estimate_basis=?,estimate_recorded_at=UTC_TIMESTAMP(),updated_at=updated_at WHERE id=?')->execute([$total, $basis, $id]);
    }
    if ($source !== null && $booking['booking_source'] === 'unknown') {
        if (!in_array($source, ['website','website_chat','facebook','manual','unknown'], true)) throw new InvalidArgumentException('Invalid source.');
        $db->prepare('UPDATE bookings SET booking_source=?,updated_at=updated_at WHERE id=?')->execute([$source, $id]);
    }
    $services = $db->query('SELECT id,name FROM resort_services')->fetchAll();
    if ($activityIds === null) {
        $activityIds = !empty($booking['service_id']) ? [(int) $booking['service_id']] : [];
        // Only labeled selections, never arbitrary guest prose.
        if (preg_match('/Requested (?:rental )?activities:\s*([^\r\n]+)/iu', (string) $booking['message'], $matches)) {
            $names = array_map('trim', explode(',', $matches[1]));
            foreach ($services as $service) foreach ($names as $name) if (strcasecmp($name, $service['name']) === 0) $activityIds[] = (int) $service['id'];
        }
    }
    $db->prepare('DELETE FROM booking_activity_requests WHERE booking_id=?')->execute([$id]);
    $insert = $db->prepare('INSERT INTO booking_activity_requests (booking_id,service_id,service_name) VALUES (?,?,?)');
    foreach ($services as $service) if (in_array((int) $service['id'], $activityIds, true)) $insert->execute([$id, $service['id'], $service['name']]);
}
