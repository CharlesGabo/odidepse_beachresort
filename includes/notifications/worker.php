<?php
declare(strict_types=1);
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/transport.php';

function notificationSchedule(PDO $db, ?DateTimeImmutable $now = null): void
{
    $now = ($now ?? new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->setTimezone(new DateTimeZone('Asia/Manila'));
    if (!notificationEnabled() || $now->format('H:i') < '07:00') return;
    $today = $now->format('Y-m-d'); $tomorrow = $now->modify('+1 day')->format('Y-m-d');
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) $db->beginTransaction();
    try {
        $query = $db->prepare("SELECT * FROM bookings WHERE status = 'confirmed' AND check_in = ? ORDER BY id FOR UPDATE");
        $query->execute([$tomorrow]);
        foreach ($query->fetchAll() as $booking) {
            notificationQueue($db, 'customer.reminder', $booking['email'], ['booking' => notificationBookingSnapshot($booking), 'scheduled_date' => $today], 'reminder:' . $booking['id'] . ':' . $tomorrow, (int) $booking['id']);
        }
        $query = $db->prepare("SELECT reference_code,guest_name,status,check_in,check_out FROM bookings WHERE status IN ('pending','confirmed','checked_in') AND (status <> 'confirmed' OR check_in <= ?) ORDER BY check_in, id");
        $query->execute([$tomorrow]);
        $groups = ['Pending requests' => [], 'Arriving today' => [], 'Checked in' => [], 'Departing today / overdue' => [], 'Overdue arrivals (review no-shows)' => [], 'Arriving tomorrow' => []];
        foreach ($query->fetchAll() as $b) {
            $line = $b['reference_code'] . ' | ' . $b['guest_name'] . ' | ' . $b['check_in'] . ' to ' . $b['check_out'];
            if ($b['status'] === 'pending') $groups['Pending requests'][] = $line;
            if ($b['status'] === 'checked_in') { $groups['Checked in'][] = $line; if ($b['check_out'] <= $today) $groups['Departing today / overdue'][] = $line; }
            if ($b['status'] === 'confirmed') {
                if ($b['check_in'] === $today) $groups['Arriving today'][] = $line;
                if ($b['check_in'] < $today) $groups['Overdue arrivals (review no-shows)'][] = $line;
                if ($b['check_in'] === $tomorrow) $groups['Arriving tomorrow'][] = $line;
            }
        }
        $summary = 'Operations for ' . $today . ' (Asia/Manila)';
        foreach ($groups as $title => $rows) $summary .= "\n\n" . $title . ': ' . count($rows) . "\n" . implode("\n", array_slice($rows, 0, 50)) . (count($rows) > 50 ? "\nSee remaining records in admin." : '');
        $summary .= "\n\nEmail failures / uncertain delivery: " . $db->query("SELECT COUNT(*) FROM email_jobs WHERE status IN ('failed','unknown')")->fetchColumn();
        $summary .= "\nFacebook delivery failures: " . $db->query("SELECT COUNT(*) FROM facebook_jobs WHERE status = 'failed'")->fetchColumn();
        foreach (notificationAdminRecipients() as $recipient) notificationQueue($db, 'admin.digest', $recipient, ['summary' => $summary, 'scheduled_date' => $today], 'digest:' . $today);
        if ($ownsTransaction) $db->commit();
    } catch (Throwable $error) { if ($ownsTransaction && $db->inTransaction()) $db->rollBack(); throw $error; }
}

function notificationJobCurrent(PDO $db, array $job): bool
{
    if (!str_starts_with($job['event_type'], 'customer.') || !$job['booking_id']) return true;
    $q = $db->prepare('SELECT * FROM bookings WHERE id = ?'); $q->execute([$job['booking_id']]); $b = $q->fetch();
    if (!$b || strcasecmp($b['email'], $job['recipient']) !== 0) return false;
    $payload = json_decode($job['payload_json'], true, 32, JSON_THROW_ON_ERROR);
    $snapshot = $payload['booking'];
    // Superseded snapshots must not tell guests that old dates/status are current.
    foreach (['status','check_in','check_out','stay_type','guests'] as $field) if ((string) $snapshot[$field] !== (string) $b[$field]) return false;
    if ($job['event_type'] === 'customer.reminder') {
        $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
        return $b['status'] === 'confirmed' && $b['check_in'] === $today->modify('+1 day')->format('Y-m-d');
    }
    return true;
}

function notificationRunWorker(PDO $db, array $ids = [], bool $schedule = true, int $limit = 10, ?callable $transport = null): int
{
    if ($db->inTransaction()) throw new LogicException('Worker must run after commit.');
    $ready = notificationReadiness();
    $db->exec('UPDATE notification_settings SET worker_seen_at = UTC_TIMESTAMP() WHERE id = 1');
    if (!notificationEnabled() || (!$transport && !$ready['ready'])) return 0;
    $lockName = 'odidepse-email-' . substr(hash('sha256', (string) $db->query('SELECT DATABASE()')->fetchColumn()), 0, 24);
    $q = $db->prepare('SELECT GET_LOCK(?, 0)'); $q->execute([$lockName]);
    if ((int) $q->fetchColumn() !== 1) return 0;
    $sent = 0; $started = microtime(true);
    try {
        // A crashed process may have sent DATA; never automatically replay it.
        $db->exec("UPDATE email_jobs SET status = 'unknown', error_code = 'delivery_unconfirmed' WHERE status = 'processing' AND started_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE");
        if ($schedule) notificationSchedule($db);
        $ids = array_values(array_filter($ids, static fn($id) => is_int($id) && $id > 0));
        $filter = $ids ? ' AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')' : '';
        for ($i = 0; $i < $limit && microtime(true) - $started < 20; $i++) {
            $db->beginTransaction();
            $q = $db->prepare("SELECT * FROM email_jobs WHERE status IN ('pending','retry_wait') AND next_attempt_at <= UTC_TIMESTAMP() {$filter} ORDER BY id LIMIT 1 FOR UPDATE"); $q->execute($ids); $job = $q->fetch();
            if (!$job) { $db->commit(); break; }
            $settings = notificationSettings($db);
            $active = ($job['event_type'] === 'admin.test' || ($settings['events'][$job['event_type']] ?? false)) && notificationJobCurrent($db, $job);
            $payload = json_decode($job['payload_json'], true, 32, JSON_THROW_ON_ERROR);
            if ($job['event_type'] === 'admin.digest' && ($payload['scheduled_date'] ?? '') !== (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d')) $active = false;
            if (str_starts_with($job['event_type'], 'admin.') && !in_array($job['recipient'], notificationAdminRecipients(), true)) $active = false;
            if (!$active) {
                $db->prepare("UPDATE email_jobs SET status = 'cancelled', error_code = 'disabled_or_superseded' WHERE id = ?")->execute([$job['id']]); $db->commit(); continue;
            }
            $db->prepare("UPDATE email_jobs SET status = 'processing', attempts = attempts + 1, started_at = UTC_TIMESTAMP(), error_code = NULL WHERE id = ?")->execute([$job['id']]);
            $db->commit(); $job['attempts']++;
            try { $result = $transport ? $transport($job) : notificationSmtpSend($job); }
            catch (Throwable $error) { $result = ['status' => 'unknown', 'code' => 'delivery_unconfirmed']; error_log('Email transport error: ' . get_class($error)); }
            if ($result['status'] === 'retry_wait' && $job['attempts'] >= 5) $result = ['status' => 'failed', 'code' => 'retry_limit'];
            $delay = 60 * (2 ** min(4, $job['attempts'] - 1));
            $db->prepare("UPDATE email_jobs SET status = ?, error_code = ?, next_attempt_at = TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP()), sent_at = IF(? = 'succeeded', UTC_TIMESTAMP(), NULL) WHERE id = ? AND status = 'processing'")
                ->execute([$result['status'], $result['code'], $delay, $result['status'], $job['id']]);
            if ($result['status'] === 'succeeded') $sent++;
        }
        if ($schedule) {
            // Keep dedupe tombstones, remove personal payloads after 90 days.
            $db->exec("UPDATE email_jobs SET recipient = '', subject = '', payload_json = '{}' WHERE status IN ('succeeded','failed','unknown','cancelled','skipped') AND created_at < CURRENT_TIMESTAMP - INTERVAL 90 DAY AND payload_json <> '{}'");
            $db->exec("UPDATE booking_events SET metadata_json = '{}', staff_note = '', cancellation_reason = '' WHERE created_at < CURRENT_TIMESTAMP - INTERVAL 90 DAY AND metadata_json <> '{}'");
        }
    } finally {
        if ($db->inTransaction()) $db->rollBack();
        $q = $db->prepare('SELECT RELEASE_LOCK(?)'); $q->execute([$lockName]);
    }
    return $sent;
}
