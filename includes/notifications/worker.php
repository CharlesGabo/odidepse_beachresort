<?php
declare(strict_types=1);
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/transport.php';

function notificationDigestData(PDO $db, DateTimeImmutable $now): array
{
    $now = $now->setTimezone(new DateTimeZone('Asia/Manila'));
    $today = $now->format('Y-m-d');
    $tomorrow = $now->modify('+1 day')->format('Y-m-d');
    $query = $db->prepare("SELECT reference_code,guest_name,status,check_in,check_out FROM bookings WHERE status IN ('pending','confirmed','checked_in') AND (status <> 'confirmed' OR check_in <= ?) ORDER BY check_in, id");
    $query->execute([$tomorrow]);
    $groups = [
        'pending' => ['label' => 'Pending requests', 'items' => []],
        'arriving_today' => ['label' => 'Arriving today', 'items' => []],
        'checked_in' => ['label' => 'Checked in', 'items' => []],
        'departing_today' => ['label' => 'Departing today', 'items' => []],
        'overdue_departures' => ['label' => 'Overdue check-outs', 'items' => []],
        'overdue_arrivals' => ['label' => 'Possible no-shows', 'items' => []],
        'arriving_tomorrow' => ['label' => 'Arriving tomorrow', 'items' => []],
    ];
    foreach ($query->fetchAll() as $booking) {
        $item = array_intersect_key($booking, array_flip(['reference_code', 'guest_name', 'check_in', 'check_out']));
        if ($booking['status'] === 'pending') $groups['pending']['items'][] = $item;
        if ($booking['status'] === 'checked_in') {
            $groups['checked_in']['items'][] = $item;
            if ($booking['check_out'] === $today) $groups['departing_today']['items'][] = $item;
            if ($booking['check_out'] < $today) $groups['overdue_departures']['items'][] = $item;
        }
        if ($booking['status'] === 'confirmed') {
            if ($booking['check_in'] === $today) $groups['arriving_today']['items'][] = $item;
            if ($booking['check_in'] < $today) $groups['overdue_arrivals']['items'][] = $item;
            if ($booking['check_in'] === $tomorrow) $groups['arriving_tomorrow']['items'][] = $item;
        }
    }
    $emailIssues = (int) $db->query("SELECT COUNT(*) FROM email_jobs WHERE status IN ('failed','unknown')")->fetchColumn();
    $facebookIssues = (int) $db->query("SELECT COUNT(*) FROM facebook_jobs WHERE status = 'failed'")->fetchColumn();
    $summary = 'Operations for ' . $today . ' (Asia/Manila)';
    foreach ($groups as $group) {
        $rows = array_map(static fn(array $item): string => $item['reference_code'] . ' | ' . $item['guest_name'] . ' | ' . $item['check_in'] . ' to ' . $item['check_out'], $group['items']);
        $summary .= "\n\n" . $group['label'] . ': ' . count($rows) . "\n" . implode("\n", array_slice($rows, 0, 50)) . (count($rows) > 50 ? "\nSee remaining records in admin." : '');
    }
    $summary .= "\n\nEmail failures / uncertain delivery: {$emailIssues}";
    $summary .= "\nFacebook delivery failures: {$facebookIssues}";
    return ['date' => $today, 'timezone' => 'Asia/Manila', 'groups' => $groups, 'email_issues' => $emailIssues, 'facebook_issues' => $facebookIssues, 'summary' => $summary];
}

function notificationDigestSummary(PDO $db, DateTimeImmutable $now): string
{
    return notificationDigestData($db, $now)['summary'];
}

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
        $digest = notificationDigestData($db, $now);
        foreach (notificationAdminRecipients() as $recipient) notificationQueue($db, 'admin.digest', $recipient, ['summary' => $digest['summary'], 'digest' => $digest, 'scheduled_date' => $today], 'digest:' . $today);
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
