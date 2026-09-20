<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/analytics.php';
requireMethod('POST');
requireAdmin();
requireCsrfToken();
readJsonBody();
if (!analyticsMockAllowed()) jsonResponse(['message' => 'Mock analytics are disabled in this environment.'], 403);
// A seed identifies a repeatable synthetic dataset; operational tables are never written.
jsonResponse(['status' => 'success', 'dataset' => 'mock', 'seed' => random_int(1, 2147483646)]);
