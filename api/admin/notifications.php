<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
require_once dirname(__DIR__, 2) . '/includes/notifications/admin.php';
$method = requireMethod('GET', 'POST');
$admin = requireAdmin();
try {
    $db = database();
    if ($method === 'GET') {
        $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100000]]) ?: 1;
        $status = is_string($_GET['status'] ?? '') ? ($_GET['status'] ?? '') : '';
        if (!in_array($status, ['', 'pending','processing','retry_wait','succeeded','failed','unknown','skipped','cancelled'], true)) throw new InvalidArgumentException('Invalid delivery filter.');
        jsonResponse(notificationAdminRead($db, $page, $status));
    }
    requireCsrfToken();
    $result = notificationAdminMutate($db, readJsonBody(), (int) $admin['id']);
    notificationFlushAfterResponse();
    jsonResponse($result);
} catch (InvalidArgumentException $error) { jsonResponse(['message' => $error->getMessage()], 422); }
catch (DomainException $error) { jsonResponse(['message' => $error->getMessage()], 409); }
catch (Throwable $error) {
    error_log('Notification administration failed: ' . get_class($error));
    jsonResponse(['message' => 'Notifications are unavailable. Check that email setup has been completed.'], 503);
}
