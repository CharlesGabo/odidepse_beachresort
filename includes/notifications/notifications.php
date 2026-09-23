<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/shared/database.php';

function notificationSchemaAvailable(PDO $db): bool
{
    static $available = [];
    $key = spl_object_id($db);
    if (!array_key_exists($key, $available)) {
        $count = $db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('notification_settings','booking_events','email_jobs')")->fetchColumn();
        $available[$key] = (int) $count === 3;
    }
    return $available[$key];
}

function notificationTypes(): array
{
    return [
        'customer.created' => 'Customer: request received', 'customer.updated' => 'Customer: request or dates changed',
        'customer.room_changed' => 'Customer: accommodation changed', 'customer.confirmed' => 'Customer: booking confirmed',
        'customer.checked_in' => 'Customer: welcome / checked in', 'customer.completed' => 'Customer: thank-you',
        'customer.cancelled' => 'Customer: cancellation', 'customer.reminder' => 'Customer: arrival reminder',
        'admin.created' => 'Admin: new booking', 'admin.updated' => 'Admin: request or dates changed',
        'admin.room_changed' => 'Admin: accommodation changed', 'admin.confirmed' => 'Admin: booking confirmed',
        'admin.checked_in' => 'Admin: checked in', 'admin.completed' => 'Admin: completed stay',
        'admin.cancelled' => 'Admin: cancelled request', 'admin.facebook_alert' => 'Admin: Facebook attention needed',
        'admin.facebook_failed' => 'Admin: Facebook delivery failed', 'admin.digest' => 'Admin: daily operations digest',
    ];
}

function notificationSettings(PDO $db): array
{
    $row = $db->query('SELECT revision, settings_json, worker_seen_at FROM notification_settings WHERE id = 1')->fetch();
    if (!$row) throw new RuntimeException('Notification setup required.');
    $saved = json_decode($row['settings_json'], true, 16, JSON_THROW_ON_ERROR);
    return ['revision' => (int) $row['revision'], 'events' => array_replace(array_fill_keys(array_keys(notificationTypes()), true), $saved['events'] ?? []),
        'review_url' => $saved['review_url'] ?? '', 'worker_seen_at' => $row['worker_seen_at'], 'digest_time' => '07:00', 'reminder_days' => 1];
}

function notificationAddress(string $value): bool
{
    return strlen($value) <= 190 && !preg_match('/[\r\n\x00]/', $value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function notificationAdminRecipients(bool $strict = false): array
{
    $list = array_values(array_unique(array_filter(array_map(static fn($s) => strtolower(trim($s)), explode(',', (string) getenv('MAIL_ADMIN_RECIPIENTS'))))));
    foreach ($list as $recipient) if (!notificationAddress($recipient)) {
        if ($strict) throw new InvalidArgumentException('Invalid configured admin recipient.');
        return [];
    }
    if (count($list) > 10) {
        if ($strict) throw new InvalidArgumentException('At most ten admin recipients are supported.');
        return [];
    }
    return $list;
}

function notificationSafeUrl(string $url): bool
{
    return strlen($url) <= 2048 && filter_var($url, FILTER_VALIDATE_URL) !== false
        && strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https'
        && !parse_url($url, PHP_URL_USER) && !parse_url($url, PHP_URL_PASS) && !preg_match('/[\r\n]/', $url);
}

function notificationEnabled(): bool { return getenv('MAIL_ENABLED') === '1'; }

function notificationSavedRoomChanges(PDO $db, array $history, int $actor, string $note): void
{
    $first = []; $last = [];
    foreach ($history as $move) { $first[$move['id']] ??= $move; $last[$move['id']] = $move; }
    ksort($last, SORT_NUMERIC);
    foreach ($last as $bookingId => $move) {
        $query = $db->prepare('SELECT * FROM bookings WHERE id = ? FOR UPDATE'); $query->execute([$bookingId]); $current = $query->fetch();
        if (!$current || (int) $current['stay_id'] !== (int) $move['moved_stay_id'] || (int) $current['room_index'] !== (int) $move['moved_room_index']) {
            throw new DomainException('A moved booking has changed. Refresh and review the room arrangement.');
        }
        // Unit numbers are internal. Only notify a changed guest-facing accommodation.
        if ((int) $first[$bookingId]['stay_id'] !== (int) $current['stay_id'] || $first[$bookingId]['stay_type'] !== $current['stay_type']) {
            notificationBookingEvent($db, (int) $bookingId, 'room_changed', $actor, $note, key: 'room-save:' . ($move['notification_key'] ?? hash('sha256', json_encode($move))));
        }
    }
}

function notificationBookingSnapshot(array $booking): array
{
    $snapshot = array_intersect_key($booking, array_flip(['id','reference_code','guest_name','email','check_in','check_out','guests','stay_type','service_name','status']));
    foreach (['preferred_arrival' => '/Preferred arrival:\s*(\d{1,2}:\d{2})/i', 'preferred_departure' => '/Preferred departure:\s*(\d{1,2}:\d{2})/i', 'requested_activities' => '/Requested rental activities:\s*([^\n]+)/i'] as $field => $pattern) {
        if (preg_match($pattern, $booking['message'] ?? '', $match)) $snapshot[$field] = trim($match[1]);
    }
    return $snapshot;
}

// The caller owns the transaction. Disabled events are recorded, never backfilled later.
function notificationQueue(PDO $db, string $type, string $recipient, array $payload, string $key, ?int $bookingId = null, ?int $eventId = null, bool $allowed = true): ?int
{
    if (!isset(notificationTypes()[$type]) && $type !== 'admin.test') throw new InvalidArgumentException('Unknown notification event.');
    $settings = notificationSettings($db);
    $enabled = notificationEnabled() && ($type === 'admin.test' || ($settings['events'][$type] ?? false));
    $error = !$allowed ? 'staff_opt_out' : (!notificationAddress($recipient) ? 'missing_email' : (!$enabled ? 'disabled' : null));
    $recipient = strtolower(trim($recipient));
    // Recipient-based public submission protection supplements the existing IP limit.
    if ($error === null && str_starts_with($type, 'customer.')) {
        $query = $db->prepare("SELECT COUNT(*) FROM email_jobs WHERE recipient = ? AND status NOT IN ('skipped','cancelled') AND created_at >= CURRENT_TIMESTAMP - INTERVAL 1 HOUR");
        $query->execute([$recipient]);
        if ((int) $query->fetchColumn() >= 10) $error = 'recipient_rate_limit';
    }
    require_once __DIR__ . '/templates.php';
    $payload['review_url'] = $type === 'customer.completed' ? $settings['review_url'] : '';
    $render = notificationRender($type, $payload);
    $query = $db->prepare('INSERT INTO email_jobs (dedupe_key,event_type,booking_id,booking_event_id,recipient,subject,payload_json,status,error_code,next_attempt_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
    $query->execute([hash('sha256', $key . '|' . $type . '|' . $recipient), $type, $bookingId, $eventId, $recipient, $render['subject'], json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $error ? 'skipped' : 'pending', $error]);
    $id = (int) $db->lastInsertId();
    if ($error === null) $GLOBALS['notification_immediate_ids'][$id] = $id;
    return $id;
}

function notificationBookingEvent(PDO $db, int $bookingId, string $type, ?int $actor = null, string $note = '', string $reason = '', bool $customer = true, ?string $key = null): array
{
    if (!$db->inTransaction()) throw new LogicException('Booking notifications require a transaction.');
    if (!notificationSchemaAvailable($db)) return ['customer' => 'setup_required'];
    $query = $db->prepare('SELECT * FROM bookings WHERE id = ?'); $query->execute([$bookingId]); $booking = $query->fetch();
    if (!$booking) throw new RuntimeException('Booking missing.');
    $snapshot = notificationBookingSnapshot($booking);
    $key ??= $type === 'created' ? 'created:' . $bookingId : bin2hex(random_bytes(16));
    $query = $db->prepare('INSERT INTO booking_events (booking_id,event_key,event_type,actor_id,staff_note,cancellation_reason,metadata_json) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
    $query->execute([$bookingId, $key, $type, $actor, $note, $reason, json_encode($snapshot, JSON_THROW_ON_ERROR)]);
    $eventId = (int) $db->lastInsertId();
    $payload = ['booking' => $snapshot, 'note' => $note, 'reason' => $reason];
    $customerJob = notificationQueue($db, 'customer.' . $type, (string) $booking['email'], $payload, 'event:' . $eventId, $bookingId, $eventId, $customer);
    foreach (notificationAdminRecipients() as $recipient) notificationQueue($db, 'admin.' . $type, $recipient, $payload, 'event:' . $eventId, $bookingId, $eventId);
    $query = $db->prepare('SELECT status, error_code FROM email_jobs WHERE id = ?'); $query->execute([$customerJob]); $job = $query->fetch();
    return ['customer' => $job['status'] === 'pending' ? 'queued' : ($job['error_code'] === 'staff_opt_out' ? 'suppressed' : ($job['error_code'] ?: $job['status']))];
}

function notificationFacebookAudit(PDO $db, string $action, string $entity, ?int $id): void
{
    if (!$id || !in_array($action, ['staff_alert_created', 'comment_edited_hidden', 'failed'], true)) return;
    if (!notificationSchemaAvailable($db)) return;
    $revision = '';
    if ($entity === 'event' && in_array($action, ['staff_alert_created', 'comment_edited_hidden'], true)) {
        $q = $db->prepare('SELECT id, kind, guest_name, category, booking_id, status, revision FROM facebook_events WHERE id = ?'); $q->execute([$id]); $event = $q->fetch();
        // Booking events have their own alert; do not send the same staff alert twice.
        if (!$event || ($event['booking_id'] && $event['status'] === 'converted')) return;
        $revision = ':' . $event['revision'];
        $payload = ['summary' => 'Facebook ' . $event['kind'] . ' from ' . $event['guest_name'] . ' needs attention (' . $event['category'] . '). Open the Facebook inbox to review.', 'entity_id' => $id];
        $type = 'admin.facebook_alert';
    } elseif ($entity === 'job' && $action === 'failed') {
        $payload = ['summary' => 'Facebook delivery job #' . $id . ' could not be completed. Open the Facebook workspace to review.', 'entity_id' => $id];
        $type = 'admin.facebook_failed';
    } else return;
    foreach (notificationAdminRecipients() as $recipient) notificationQueue($db, $type, $recipient, $payload, 'facebook:' . $entity . ':' . $id . $revision);
}

function notificationFlushAfterResponse(): void
{
    if (!notificationEnabled() || empty($GLOBALS['notification_immediate_ids'])) return;
    $ids = array_values($GLOBALS['notification_immediate_ids']);
    $GLOBALS['notification_immediate_ids'] = [];
    register_shutdown_function(static function () use ($ids): void {
        try {
            $db = database();
            // Never send from a still-open/rolled-back booking transaction.
            if ($db->inTransaction()) return;
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            require_once __DIR__ . '/worker.php';
            notificationRunWorker($db, $ids, false, 3);
        } catch (Throwable $error) { error_log('Email immediate delivery deferred: ' . get_class($error)); }
    });
}
