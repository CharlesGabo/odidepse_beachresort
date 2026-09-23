<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
try {
    $db = database();
    $before = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $sql = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/014_email_notifications.sql');
    $db->exec($sql);
    if ($before !== (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn()) throw new RuntimeException();
    echo "Email tables ready. Existing bookings preserved. SMTP remains controlled by MAIL_ENABLED.\n";
} catch (Throwable $error) {
    $driver = $error instanceof PDOException ? (string) ($error->errorInfo[1] ?? $error->getCode()) : '';
    fwrite(STDERR, 'Email setup failed: ' . get_class($error) . ' (' . $driver . "). Check database availability and permissions privately.\n"); exit(1);
}
