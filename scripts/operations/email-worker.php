<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/notifications/worker.php';
try {
    $db = database();
    if (in_array('--digest-now', $argv, true)) {
        $readiness = notificationReadiness();
        if (!$readiness['enabled'] || !$readiness['ready']) throw new RuntimeException('Email configuration is not ready.');
        $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
        $db->beginTransaction();
        $digest = notificationDigestData($db, $now);
        $key = 'manual-digest:' . $now->format('Y-m-d-His') . ':' . bin2hex(random_bytes(4));
        foreach (notificationAdminRecipients() as $recipient) {
            notificationQueue($db, 'admin.digest', $recipient, ['summary' => $digest['summary'], 'digest' => $digest, 'scheduled_date' => $now->format('Y-m-d')], $key);
        }
        $db->commit();
        $ids = array_values($GLOBALS['notification_immediate_ids']);
        $GLOBALS['notification_immediate_ids'] = [];
        $count = notificationRunWorker($db, $ids, false, max(1, count($ids)));
        echo "Manual digest queued; {$count} accepted by SMTP.\n";
        exit;
    }
    $count = notificationRunWorker($db);
    echo "Email worker finished; {$count} accepted by SMTP.\n";
}
catch (Throwable $error) { fwrite(STDERR, 'Email worker failed: ' . get_class($error) . "\n"); exit(1); }
