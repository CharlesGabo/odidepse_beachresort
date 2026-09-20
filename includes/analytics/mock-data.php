<?php
declare(strict_types=1);

function analyticsMockAllowed(): bool
{
    return getenv('ANALYTICS_MOCK_DATA_ENABLED') === '1'
        && in_array(getenv('DB_HOST'), ['127.0.0.1', 'localhost'], true)
        && getenv('DB_NAME') === 'odidepse_db';
}

/** Synthetic inputs for the normal analytics engine. Never inserts operational records. */
function analyticsMockDataset(array $stays, array $services, string $today, int $seed): array
{
    $state = max(1, $seed);
    $random = static function (int $maximum) use (&$state): int {
        $state = ($state * 48271) % 2147483647;
        return $state % ($maximum + 1);
    };
    $anchor = new DateTimeImmutable($today, new DateTimeZone('Asia/Manila'));
    $sources = ['website', 'website', 'website_chat', 'facebook', 'facebook', 'manual', 'unknown'];
    $bookings = $payments = $transitions = [];
    $eligible = array_values(array_filter($stays, static fn($stay) => $stay['enabled'] && !$stay['archived']));
    if (!$eligible) throw new InvalidArgumentException('Enable an accommodation before generating mock analytics.');
    foreach (array_slice($eligible, 0, 20) as $index => $stay) {
        $units = $stay['style'] === 'exclusive' ? 1 : max(1, (int) $stay['room_count']);
        for ($slot = 0; $slot < min(3, $units); $slot++) {
            for ($offset = -730; $offset < 90;) {
                $date = $anchor->modify(sprintf('%+d days', $offset));
                $probability = 25 + 25 * ($offset + 730) / 820 + ((int) $date->format('N') >= 5 ? 20 : 0) + 12 * sin(2 * M_PI * (int) $date->format('z') / 365.25);
                if ($random(99) >= $probability) { $offset++; continue; }
                $nights = 1 + $random(2);
                $checkIn = $date->format('Y-m-d');
                $checkOut = $date->modify("+$nights days")->format('Y-m-d');
                $outcome = $random(99);
                $status = $checkOut <= $today ? ($outcome < 12 ? 'cancelled' : ($outcome < 17 ? 'confirmed' : 'completed'))
                    : ($checkIn <= $today ? 'checked_in' : ($outcome < 15 ? 'cancelled' : ($outcome < 40 ? 'pending' : 'confirmed')));
                $created = min($today, $date->modify('-' . (2 + $random(35)) . ' days')->format('Y-m-d'));
                $guests = min(max(1, (int) ($stay['max_guests'] ?? 2)), 2 + $random(6));
                $amount = (180000 + $index * 55000 + $random(4) * 10000) * $nights;
                $missingTotal = $random(99) < 4 || ($status === 'pending' && $random(1) === 0);
                $id = -(count($bookings) + 1);
                $service = $services && $random(2) === 0 ? $services[$random(count($services) - 1)]['name'] : null;
                $bookings[] = ['id' => $id, 'check_in' => $checkIn, 'check_out' => $checkOut, 'guests' => $guests,
                    'stay_id' => (int) $stay['id'], 'stay_type' => $stay['name'], 'stay_plan_json' => null,
                    'service_name' => $service, 'status' => $status, 'created_at' => "$created 09:00:00",
                    'updated_at' => min($checkOut, $today) . ' 12:00:00', 'agreed_total' => $missingTotal ? null : financeDecimal($amount),
                    'booking_source' => $sources[$random(count($sources) - 1)]];
                if (!$missingTotal && $status !== 'pending') {
                    $paid = $status === 'completed' && $random(4) !== 0 ? $amount : intdiv($amount, 2);
                    $payments[] = ['booking_id' => $id, 'kind' => 'payment', 'amount' => financeDecimal($paid), 'paid_on' => $created, 'voided_at' => null];
                    if ($status === 'cancelled') $payments[] = ['booking_id' => $id, 'kind' => 'refund', 'amount' => financeDecimal($paid), 'paid_on' => min($today, $date->modify('-1 day')->format('Y-m-d')), 'voided_at' => null];
                }
                if ($status !== 'pending') $transitions[] = ['booking_id' => $id, 'new_status' => $status === 'cancelled' ? 'cancelled' : 'confirmed', 'created_at' => "$created 10:00:00"];
                if ($status === 'completed') $transitions[] = ['booking_id' => $id, 'new_status' => 'completed', 'created_at' => "$checkOut 11:00:00"];
                $offset += $nights;
            }
        }
    }
    return ['bookings' => $bookings, 'payments' => $payments, 'transitions' => $transitions];
}
