<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/facebook-automations.php';

try {
    $db = database();
    $db->beginTransaction();
    $db->exec('DELETE FROM facebook_webhook_state WHERE id = 1');
    facebookAudit($db, null, 'webhook_reset', 'connection', 1);
    $db->commit();
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Could not reset the webhook state.' . PHP_EOL);
    exit(1);
}
