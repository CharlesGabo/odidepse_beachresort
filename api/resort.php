<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/resort.php';
requireMethod('GET');
try { jsonResponse(['status' => 'success'] + resortSnapshot(database())); }
catch (Throwable $error) {
    error_log('Resort content read failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'Resort information is temporarily unavailable. Please try again.'], 503);
}
