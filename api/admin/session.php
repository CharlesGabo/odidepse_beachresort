<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';

requireMethod('GET');
startAdminSession();
$user = $_SESSION['admin_user'] ?? null;

if (!is_array($user) || ($user['role'] ?? '') !== 'admin' || !isset($user['id'])) {
    jsonResponse(['status' => 'success', 'authenticated' => false]);
}

jsonResponse([
    'status' => 'success',
    'authenticated' => true,
    'user' => $user,
    'csrf_token' => csrfToken(),
]);
