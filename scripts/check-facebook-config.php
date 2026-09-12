<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/facebook-automations.php';

try {
    $settings = facebookSettings(database());
    echo 'automatic_replies=' . (!empty($settings['rules']['prepare_replies']) ? 'yes' : 'no') . PHP_EOL;
    foreach (['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN', 'META_GRAPH_API_VERSION'] as $name) {
        echo strtolower($name) . '=' . (getenv($name) !== false && getenv($name) !== '' ? 'configured' : 'missing') . PHP_EOL;
    }
    echo 'php_curl=' . (extension_loaded('curl') ? 'available' : 'missing') . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Configuration check failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
