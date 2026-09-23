<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/notifications/worker.php';
try { $count = notificationRunWorker(database()); echo "Email worker finished; {$count} accepted by SMTP.\n"; }
catch (Throwable $error) { fwrite(STDERR, 'Email worker failed: ' . get_class($error) . "\n"); exit(1); }
