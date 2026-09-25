<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/bookings/booking-reporting.php';
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1', 'localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('This command supports the local project database only.');
    $db = in_array('--local-maintenance', $argv, true)
        ? new PDO('mysql:host=127.0.0.1;port=' . (int) requireEnvironment('DB_PORT') . ';dbname=odidepse_db;charset=utf8mb4', 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ])
        : database();
    $count = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $backfillOnly = in_array('--backfill-only', $argv, true);
    if (!in_array('--apply', $argv, true) && !$backfillOnly) {
        echo json_encode($db->query("SELECT COUNT(*) bookings, MIN(created_at) first_record, SUM(status = 'completed') completed FROM bookings")->fetch(), JSON_PRETTY_PRINT) . "\nUse --apply to back up and apply migration 016 locally.\n";
        exit;
    }
    // A generated recovery artifact outside the project/Apache document root.
    $directory = sys_get_temp_dir() . '/odidepse-backup-' . bin2hex(random_bytes(8));
    if (!mkdir($directory, 0700)) throw new RuntimeException('Cannot create the backup directory.');
    $path = $directory . '/database.sql';
    $file = fopen($path, 'xb');
    if (!$file) throw new RuntimeException('Cannot create backup.');
    $write = static function (string $value) use ($file): void { if (fwrite($file, $value) !== strlen($value)) throw new RuntimeException('Backup write failed.'); };
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();
    $write("-- Local recovery backup. Restore only into a deliberate recovery database.\nSET FOREIGN_KEY_CHECKS=0;\n");
    foreach ($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        if (!preg_match('/\A[a-zA-Z0-9_]+\z/', $table)) throw new RuntimeException('Unexpected table name.');
        $schema = $db->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
        $write($schema . ";\n");
        $rows = $db->query("SELECT * FROM `$table`");
        while ($row = $rows->fetch()) {
            $columns = implode(',', array_map(static fn($key) => '`' . $key . '`', array_keys($row)));
            $values = implode(',', array_map(static fn($value) => $value === null ? 'NULL' : $db->quote((string) $value), array_values($row)));
            $write("INSERT INTO `$table` ($columns) VALUES ($values);\n");
        }
    }
    $write("SET FOREIGN_KEY_CHECKS=1;\n");
    if (!fflush($file)) throw new RuntimeException('Backup flush failed.');
    fclose($file);
    $db->commit();
    echo "Recovery backup: $path\n";
    $sql = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/016_resort_analytics.sql');
    if (!$backfillOnly) $db->exec($sql);
    if (!bookingReportingReady($db)) throw new RuntimeException('Import migration 016 with the maintenance account before backfilling.');
    $db->beginTransaction();
    foreach ($db->query('SELECT id,reference_code FROM bookings')->fetchAll() as $booking) {
        $source = null;
        $q = $db->prepare("SELECT COUNT(*) FROM facebook_events WHERE booking_id=? AND source='facebook'");
        $q->execute([$booking['id']]);
        if ($q->fetchColumn()) $source = 'facebook';
        elseif (preg_match('/^OD-W-[A-F0-9]{18}$/', $booking['reference_code'])) $source = 'website_chat';
        bookingReportingCapture($db, (int) $booking['id'], $source);
    }
    $db->commit();
    if ((int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn() !== $count) throw new RuntimeException('Booking count verification failed.');
    foreach (['booking_payments','booking_finance_audit','booking_activity_requests'] as $table) $db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    echo "Analytics schema ready. Booking rows preserved: $count.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Local analytics setup failed: ' . $error->getMessage() . "\n");
    exit(1);
}
