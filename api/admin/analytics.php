<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/analytics.php';
requireMethod('GET');
requireAdmin();
session_write_close();
try { jsonResponse(['status' => 'success', 'analytics' => analyticsLoad(database(), analyticsFilters($_GET))]); }
catch (Throwable $error) {
    $status = $error instanceof InvalidArgumentException ? 422 : ($error->getCode() === 403 ? 403 : 503);
    jsonResponse(['message' => $status === 503 ? 'Analytics is unavailable. Check database availability and migration 013 setup.' : $error->getMessage()], $status);
}
