<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'api.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';

requireMethod('POST');
$data = readJsonBody();
$email = strtolower(cleanText($data['email'] ?? null, 190));
$password = is_string($data['password'] ?? null) ? $data['password'] : '';
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($password) < 1 || strlen($password) > 256) {
    jsonResponse(['status' => 'error', 'message' => 'The email or password is incorrect.'], 401);
}

try {
    $db = database();
    $identifier = clientIdentifier('admin-login', $email);
    $attempts = $db->prepare('SELECT COUNT(*) FROM login_attempts WHERE identifier_hash = ? AND attempted_at >= (NOW() - INTERVAL 15 MINUTE)');
    $attempts->execute([$identifier]);
    if ((int) $attempts->fetchColumn() >= 5) {
        jsonResponse(['status' => 'error', 'message' => 'Too many sign-in attempts. Try again in 15 minutes.'], 429);
    }

    $statement = $db->prepare('SELECT id, email, password_hash, display_name, role FROM admin_users WHERE email = ? AND active = 1 LIMIT 1');
    $statement->execute([$email]);
    $user = $statement->fetch();
    if (!is_array($user) || !password_verify($password, (string) $user['password_hash'])) {
        $db->prepare('INSERT INTO login_attempts (identifier_hash, attempted_at) VALUES (?, NOW())')->execute([$identifier]);
        usleep(random_int(150000, 350000));
        jsonResponse(['status' => 'error', 'message' => 'The email or password is incorrect.'], 401);
    }

    $db->prepare('DELETE FROM login_attempts WHERE identifier_hash = ?')->execute([$identifier]);
    startAdminSession();
    session_regenerate_id(true);
    $_SESSION['admin_user'] = ['id' => (int) $user['id'], 'email' => $user['email'], 'display_name' => $user['display_name'], 'role' => $user['role']];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    jsonResponse(['status' => 'success', 'user' => $_SESSION['admin_user'], 'csrf_token' => $_SESSION['csrf_token']]);
} catch (Throwable $error) {
    error_log('Admin login failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'Sign in is temporarily unavailable.'], 500);
}
