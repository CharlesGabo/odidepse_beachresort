<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'api.php';

function startAdminSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    session_name('odidepse_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
}

function requireAdmin(): array
{
    startAdminSession();
    $user = $_SESSION['admin_user'] ?? null;
    if (!is_array($user) || ($user['role'] ?? '') !== 'admin' || !isset($user['id'])) {
        jsonResponse(['status' => 'error', 'message' => 'Authentication required.'], 401);
    }

    return $user;
}

function csrfToken(): string
{
    startAdminSession();
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function requireCsrfToken(): void
{
    startAdminSession();
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        jsonResponse(['status' => 'error', 'message' => 'The security token is invalid. Refresh and try again.'], 403);
    }
}
