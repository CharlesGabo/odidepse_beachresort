<?php
declare(strict_types=1);
// CLI-only local smoke-test session. Never deploy scripts/local/.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/shared/auth.php';
if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1','localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') exit(1);
if (($argv[1] ?? '') === 'destroy') {
    if (!preg_match('/\A[a-zA-Z0-9,-]{20,128}\z/', $argv[2] ?? '')) exit(1);
    session_name('odidepse_admin'); session_id($argv[2]); session_start(); $_SESSION = []; session_destroy(); exit;
}
$user = database()->query("SELECT id, display_name, email, role FROM admin_users WHERE active = 1 AND role = 'admin' LIMIT 1")->fetch();
if (!$user) exit(1);
startAdminSession(); $_SESSION['admin_user'] = $user;
echo json_encode(['session_id' => session_id(), 'csrf_token' => csrfToken()]);
session_write_close();
