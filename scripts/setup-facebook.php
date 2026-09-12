<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/includes/database.php';
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1', 'localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') {
        throw new RuntimeException('This setup command only supports the local project database.');
    }
    $db = database();
    $before = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $sql = file_get_contents(dirname(__DIR__) . '/database/migrations/004_facebook_automations.sql');
    if ($sql === false) throw new RuntimeException('Migration file not found.');
    foreach (explode(';', $sql) as $statement) {
        if (trim($statement) === '') continue;
        if (preg_match('/CREATE TABLE IF NOT EXISTS (facebook_[a-z]+)/', $statement, $match)) {
            $exists = $db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
            $exists->execute([$match[1]]);
            if ((int) $exists->fetchColumn() > 0) continue;
        }
        $db->exec($statement);
    }
    foreach (['facebook_settings', 'facebook_events', 'facebook_drafts', 'facebook_jobs', 'facebook_audit'] as $table) {
        $count = (int) $db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
        echo $table . ': ' . $count . " rows\n";
    }
    $after = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    echo "Booking rows before/after: $before/$after\nFacebook Automations schema is ready. No connection was started.\n";
} catch (Throwable $error) {
    $code = $error instanceof PDOException ? (int) ($error->errorInfo[1] ?? 0) : 0;
    fwrite(STDERR, 'Setup failed (' . get_class($error) . ', driver code ' . $code . "). Check database availability and migration privileges.\n");
    exit(1);
}
