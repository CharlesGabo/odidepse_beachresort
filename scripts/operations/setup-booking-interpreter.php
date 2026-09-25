<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['localhost', '127.0.0.1'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local database required');
    $db = database();
    $before = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $column = $db->query("SHOW COLUMNS FROM facebook_jobs LIKE 'kind'")->fetch();
    if (!str_contains($column['Type'], "'conversation'")) $db->exec(file_get_contents(dirname(__DIR__, 2) . '/database/migrations/015_facebook_conversation_jobs.sql'));
    if ($before !== (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn()) throw new RuntimeException('Booking count changed');
    echo "Conversation job migration ready. Booking count unchanged. Interpreter remains opt-in.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Conversation setup failed: ' . get_class($error) . '. Check local migration permissions privately.' . PHP_EOL); exit(1);
}
