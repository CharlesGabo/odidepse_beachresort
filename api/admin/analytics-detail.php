<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/analytics-detail.php';
requireMethod('GET');
requireAdmin();
header('Cache-Control: no-store, private');
try {
    jsonResponse(['status' => 'success', 'detail' => analyticsLoadDetail(database(), $_GET)]);
} catch (InvalidArgumentException $error) {
    jsonResponse(['message' => $error->getMessage()], 422);
} catch (Throwable $error) {
    error_log('Analytics detail failed: ' . $error->getMessage());
    jsonResponse(['message' => 'Booking details are unavailable. Retry or narrow the reporting period.'], 503);
}
