<?php
declare(strict_types=1);
require_once __DIR__ . '/transport.php';

function notificationAdminRead(PDO $db, int $page, string $status): array
{
    $where = "created_at >= CURRENT_TIMESTAMP - INTERVAL 90 DAY";
    $values = [];
    if ($status !== '') { $where .= ' AND status = ?'; $values[] = $status; }
    $q = $db->prepare('SELECT COUNT(*) FROM email_jobs WHERE ' . $where); $q->execute($values); $total = (int) $q->fetchColumn();
    $offset = ($page - 1) * 25;
    $q = $db->prepare("SELECT id,event_type,booking_id,recipient,subject,status,attempts,error_code,created_at,sent_at FROM email_jobs WHERE {$where} ORDER BY id DESC LIMIT 25 OFFSET {$offset}"); $q->execute($values);
    $settings = notificationSettings($db);
    return ['status' => 'success', 'settings' => $settings, 'types' => notificationTypes(), 'readiness' => notificationReadiness(), 'jobs' => $q->fetchAll(), 'total' => $total, 'page' => $page,
        'failures' => (int) $db->query("SELECT COUNT(*) FROM email_jobs WHERE status IN ('failed','unknown') AND created_at >= CURRENT_TIMESTAMP - INTERVAL 90 DAY")->fetchColumn()];
}

function notificationAdminMutate(PDO $db, array $data, int $actor): array
{
    $action = $data['action'] ?? '';
    $db->beginTransaction();
    try {
        // Serialize setting updates, rate limits and retries.
        $db->query('SELECT id FROM notification_settings WHERE id = 1 FOR UPDATE')->fetch();
        if ($action === 'settings') {
            $settings = notificationSettings($db);
            if (($data['revision'] ?? null) !== $settings['revision']) throw new DomainException('Settings changed. Refresh before saving.');
            $events = $data['events'] ?? null; $url = $data['review_url'] ?? '';
            if (!is_array($events) || count($events) !== count(notificationTypes())) throw new InvalidArgumentException('Supply all notification settings.');
            foreach (notificationTypes() as $key => $_) if (!is_bool($events[$key] ?? null)) throw new InvalidArgumentException('Event settings must be true or false.');
            if (!is_string($url) || ($url !== '' && !notificationSafeUrl($url))) throw new InvalidArgumentException('Use a valid HTTPS feedback link or leave it blank.');
            $db->prepare('UPDATE notification_settings SET settings_json = ?, revision = revision + 1 WHERE id = 1')->execute([json_encode(['events' => $events, 'review_url' => $url], JSON_THROW_ON_ERROR)]);
            // Turning off a category cancels unsent jobs; turning it on never backfills.
            foreach ($events as $type => $enabled) if (!$enabled) $db->prepare("UPDATE email_jobs SET status = 'cancelled', error_code = 'disabled' WHERE event_type = ? AND status IN ('pending','retry_wait')")->execute([$type]);
            $message = 'Notification settings saved.';
        } elseif ($action === 'test') {
            $ready = notificationReadiness();
            if (!$ready['enabled'] || !$ready['ready']) throw new InvalidArgumentException('Configure SMTP and set MAIL_ENABLED=1 before sending a test.');
            $q = $db->query("SELECT COUNT(*) FROM email_jobs WHERE event_type = 'admin.test' AND created_at > CURRENT_TIMESTAMP - INTERVAL 10 MINUTE");
            if ((int) $q->fetchColumn() > 0) throw new DomainException('A test was queued recently. Wait ten minutes before trying again.');
            $key = 'test:' . bin2hex(random_bytes(12));
            foreach (notificationAdminRecipients() as $recipient) notificationQueue($db, 'admin.test', $recipient, ['summary' => 'Requested by administrator #' . $actor], $key);
            $message = 'Test queued for configured admin inboxes.';
        } elseif ($action === 'retry') {
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (!$id) throw new InvalidArgumentException('Choose a delivery record.');
            $q = $db->prepare("SELECT * FROM email_jobs WHERE id = ? AND created_at >= CURRENT_TIMESTAMP - INTERVAL 90 DAY FOR UPDATE"); $q->execute([$id]); $job = $q->fetch();
            if (!$job || !in_array($job['status'], ['failed','unknown'], true)) throw new DomainException('Only failed or uncertain deliveries can be retried.');
            if ($job['status'] === 'unknown' && ($data['acknowledge_duplicate_risk'] ?? false) !== true) throw new InvalidArgumentException('Confirm possible duplicate delivery before retrying an uncertain result.');
            if ((int) $job['manual_retries'] >= 3) throw new DomainException('Manual retry limit reached. Check the mail provider.');
            $ready = notificationReadiness();
            if (!$ready['enabled'] || !$ready['ready']) throw new InvalidArgumentException('Configure and enable SMTP first.');
            $db->prepare("UPDATE email_jobs SET status = 'pending', attempts = 0, manual_retries = manual_retries + 1, error_code = NULL, next_attempt_at = UTC_TIMESTAMP() WHERE id = ?")->execute([$id]);
            $GLOBALS['notification_immediate_ids'][$id] = $id;
            $message = 'Delivery queued for retry. Superseded customer messages will be cancelled.';
        } else throw new InvalidArgumentException('Unknown notification action.');
        $db->commit();
        return ['status' => 'success', 'message' => $message];
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}
