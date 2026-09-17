<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/automations/facebook-worker.php';

try {
    $processed = facebookRunDeliveryWorker();
    echo 'Facebook worker completed. Jobs processed: ' . $processed . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Facebook worker failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
