<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/insights.php';
requireMethod('POST');
$actor = requireAdmin();
requireCsrfToken();
$data = readJsonBody();
session_write_close();
try {
    $db = database(); $report = analyticsLoad($db, analyticsFilters($data));
    jsonResponse(['status' => 'success', 'result' => analyticsInsights($db, $report, (int) $actor['id'])]);
} catch (Throwable $error) {
    $status = $error instanceof InvalidArgumentException ? 422 : (in_array($error->getCode(), [403, 429], true) ? $error->getCode() : 503);
    jsonResponse(['message' => $status === 503 ? 'AI insights are temporarily unavailable.' : $error->getMessage()], $status);
}
