<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/analytics.php';
requireMethod('GET');
requireAdmin();
try {
    jsonResponse(['status' => 'success', 'report' => analyticsLoad(database(), $_GET)]);
} catch (InvalidArgumentException $error) {
    jsonResponse(['message' => $error->getMessage()], 422);
} catch (Throwable $error) {
    error_log('Analytics report failed: ' . $error->getMessage());
    jsonResponse(['message' => 'Analytics is unavailable. Check that the analytics setup is complete, then retry.'], 503);
}
