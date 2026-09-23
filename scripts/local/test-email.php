<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/notifications/worker.php';
require_once dirname(__DIR__, 2) . '/includes/notifications/admin.php';
require_once dirname(__DIR__, 2) . '/includes/notifications/templates.php';
// Process-local configuration. No SMTP transport is called by this test.
putenv('MAIL_ENABLED=0');
putenv('MAIL_ADMIN_RECIPIENTS=admin@example.test');
putenv('MAIL_FROM_ADDRESS=resort@example.test');
putenv('MAIL_REPLY_TO_ADDRESS=resort@example.test');
putenv('APP_BASE_URL=https://resort.example.test');
function emailCheck(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$bookingIds = []; $jobIds = [];
try {
    emailCheck(notificationAddress('guest@example.test'), 'Valid email');
    emailCheck(!notificationAddress("guest@example.test\r\nBcc:x@example.test"), 'Reject header injection');
    emailCheck(!notificationSafeUrl('javascript:alert(1)') && !notificationSafeUrl('https://user:secret@example.test'), 'Reject unsafe review URLs');
    $snapshot = ['id' => 1, 'reference_code' => 'OD-TEST', 'guest_name' => '<script>alert(1)</script>', 'status' => 'pending', 'check_in' => '2030-01-01', 'check_out' => '2030-01-02', 'guests' => 2, 'stay_type' => 'Test room', 'service_name' => null];
    foreach (notificationTypes() as $type => $label) {
        $render = notificationRender($type, ['booking' => $snapshot, 'note' => '<img src=x onerror=alert(1)>']);
        emailCheck(!str_contains($render['html'], '<script>') && !str_contains($render['html'], '<img '), 'HTML encoding: ' . $type);
        emailCheck(str_contains($render['text'], 'not confirmed') && !preg_match('/[\r\n]/', $render['subject']), 'Pending and subject safety: ' . $type);
    }
    $render = notificationRender('customer.completed', ['booking' => array_merge($snapshot, ['status' => 'completed'])]);
    emailCheck(!str_contains($render['html'], 'Share your feedback'), 'Blank review link omitted');
    $render = notificationRender('customer.completed', ['booking' => array_merge($snapshot, ['status' => 'completed']), 'review_url' => 'https://forms.gle/example']);
    emailCheck(str_contains($render['html'], 'https://forms.gle/example'), 'Google Forms feedback supported');
    require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->setFrom('resort@example.test', 'Odidepse Beach Resort');
    $mail->addAddress('guest@example.test');
    $mail->isHTML(true); $mail->CharSet = 'UTF-8';
    $mail->Subject = $render['subject']; $mail->Body = $render['html']; $mail->AltBody = $render['text'];
    emailCheck($mail->preSend() && str_contains($mail->getSentMIMEMessage(), 'multipart/alternative'), 'Installed PHPMailer generates HTML and text MIME without sending');
    echo "Passed email address, URL, template, HTML-escaping and feedback-link checks.\n";
    if (!in_array('--database', $argv, true)) exit;
    if (!in_array(requireEnvironment('DB_HOST'), ['localhost','127.0.0.1'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local development database required.');
    $db = database();
    emailCheck(notificationSchemaAvailable($db), 'Import database/migrations/014_email_notifications.sql before running database tests.');
    $db->beginTransaction();
    $insert = $db->prepare("INSERT INTO bookings (reference_code,guest_name,email,phone,check_in,check_out,guests,stay_type,status) VALUES (?,?,?,'','2030-01-01','2030-01-02',2,'Email test room','pending')");
    $insert->execute(['MAIL-TEST-' . bin2hex(random_bytes(4)), 'Email test', 'guest@example.test']);
    $id = (int) $db->lastInsertId();
    $result = notificationBookingEvent($db, $id, 'created');
    emailCheck($result['customer'] === 'disabled', 'Disabled mail metadata');
    notificationBookingEvent($db, $id, 'created');
    $q = $db->prepare('SELECT COUNT(*) FROM email_jobs WHERE booking_id = ?'); $q->execute([$id]);
    emailCheck((int) $q->fetchColumn() === 2, 'Duplicate event and recipient dedupe');
    $q = $db->prepare("SELECT COUNT(*) FROM email_jobs WHERE booking_id = ? AND status = 'skipped'"); $q->execute([$id]);
    emailCheck((int) $q->fetchColumn() === 2, 'Disabled events never queued');
    putenv('MAIL_ENABLED=1');
    $result = notificationBookingEvent($db, $id, 'updated', customer: false);
    emailCheck($result['customer'] === 'suppressed', 'Manual creation opt-out');
    $db->prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?")->execute([$id]);
    notificationSchedule($db, new DateTimeImmutable('2029-12-31 06:59:00', new DateTimeZone('Asia/Manila')));
    $q = $db->prepare("SELECT COUNT(*) FROM email_jobs WHERE booking_id = ? AND event_type = 'customer.reminder'"); $q->execute([$id]);
    emailCheck((int) $q->fetchColumn() === 0, 'Reminder waits for 7 AM Manila');
    notificationSchedule($db, new DateTimeImmutable('2029-12-31 07:00:00', new DateTimeZone('Asia/Manila')));
    notificationSchedule($db, new DateTimeImmutable('2029-12-31 10:00:00', new DateTimeZone('Asia/Manila')));
    $q->execute([$id]); emailCheck((int) $q->fetchColumn() === 1, 'One reminder per arrival date after delayed worker start');
    $q = $db->query("SELECT COUNT(*) FROM email_jobs WHERE event_type = 'admin.digest' AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.scheduled_date')) = '2029-12-31'");
    emailCheck((int) $q->fetchColumn() === 1, 'Daily digest deduplicated');
    if ($db->inTransaction()) $db->rollBack();
    // Isolated committed fixtures are necessary to exercise actual claim/commit/retry behavior.
    $db->beginTransaction();
    $insert->execute(['MAIL-TEST-' . bin2hex(random_bytes(4)), 'Email worker test', 'worker@example.test']);
    $id = (int) $db->lastInsertId(); $bookingIds[] = $id;
    $q = $db->prepare('SELECT * FROM bookings WHERE id = ?'); $q->execute([$id]); $b = $q->fetch();
    foreach (['success','temporary','permanent','ambiguous','stale','superseded'] as $scenario) {
        $payload = ['booking' => notificationBookingSnapshot($b)];
        if ($scenario === 'superseded') $payload['booking']['check_in'] = '2029-12-31';
        $jobIds[$scenario] = notificationQueue($db, 'customer.updated', 'worker@example.test', $payload, 'test:' . $id . ':' . $scenario, $id);
    }
    $db->commit();
    $fake = static fn($job) => ['status' => 'succeeded', 'code' => null];
    $state = static function ($jobId) use ($db) { $q = $db->prepare('SELECT status FROM email_jobs WHERE id = ?'); $q->execute([$jobId]); return $q->fetchColumn(); };
    emailCheck(notificationRunWorker($db, [$jobIds['success']], false, 1, $fake) === 1, 'Mock SMTP success');
    emailCheck(notificationRunWorker($db, [$jobIds['success']], false, 1, $fake) === 0, 'No resend after success');
    notificationRunWorker($db, [$jobIds['temporary']], false, 1, static fn($job) => ['status' => 'retry_wait', 'code' => 'smtp_temporary_failure']);
    emailCheck($state($jobIds['temporary']) === 'retry_wait', 'Temporary failure retained');
    emailCheck(notificationRunWorker($db, [$jobIds['temporary']], false, 1, $fake) === 0, 'Backoff respected');
    $db->prepare('UPDATE email_jobs SET attempts = 4, next_attempt_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$jobIds['temporary']]);
    notificationRunWorker($db, [$jobIds['temporary']], false, 1, static fn($job) => ['status' => 'retry_wait', 'code' => 'smtp_temporary_failure']);
    emailCheck($state($jobIds['temporary']) === 'failed', 'Five-attempt limit');
    notificationRunWorker($db, [$jobIds['permanent']], false, 1, static fn($job) => ['status' => 'failed', 'code' => 'smtp_rejected']);
    emailCheck($state($jobIds['permanent']) === 'failed', 'Permanent rejection');
    notificationRunWorker($db, [$jobIds['ambiguous']], false, 1, static fn($job) => ['status' => 'unknown', 'code' => 'delivery_unconfirmed']);
    emailCheck($state($jobIds['ambiguous']) === 'unknown', 'Ambiguous delivery not retried');
    $db->prepare("UPDATE email_jobs SET status = 'processing', started_at = UTC_TIMESTAMP() - INTERVAL 10 MINUTE WHERE id = ?")->execute([$jobIds['stale']]);
    notificationRunWorker($db, [$jobIds['stale']], false, 1, $fake);
    emailCheck($state($jobIds['stale']) === 'unknown', 'Crashed worker safe recovery');
    notificationRunWorker($db, [$jobIds['superseded']], false, 1, $fake);
    emailCheck($state($jobIds['superseded']) === 'cancelled', 'Stale customer snapshot cancelled');
    emailCheck((int) $db->query('SELECT COUNT(*) FROM bookings WHERE id = ' . $id)->fetchColumn() === 1, 'SMTP failures preserve booking');
    echo "Passed transactional queue, deduplication, disabled mode, opt-out, worker success, backoff, retry limit, permanent and uncertain failures, crash recovery and stale-snapshot tests. No SMTP calls made.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Email test failed: ' . ($error instanceof PDOException ? 'Database setup/permissions required (' . ($error->errorInfo[1] ?? $error->getCode()) . ')' : $error->getMessage()) . "\n");
    $failed = true;
} finally {
    if (isset($db)) {
        if ($db->inTransaction()) $db->rollBack();
        foreach ($jobIds as $jobId) $db->prepare('DELETE FROM email_jobs WHERE id = ?')->execute([$jobId]);
        foreach ($bookingIds as $bookingId) $db->prepare('DELETE FROM bookings WHERE id = ?')->execute([$bookingId]);
    }
    $GLOBALS['notification_immediate_ids'] = [];
}
if (!empty($failed)) exit(1);
