<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';

$email = strtolower(trim((string) ($argv[1] ?? '')));
$displayName = trim((string) ($argv[2] ?? ''));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($displayName) < 2 || strlen($displayName) > 100) {
    fwrite(STDERR, "Usage: php scripts/create-admin.php admin@example.com \"Display Name\"\n");
    exit(1);
}

$password = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');

try {
    $statement = database()->prepare('INSERT INTO admin_users (email, password_hash, display_name, role) VALUES (?, ?, ?, \'admin\')');
    $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT), $displayName]);
    fwrite(STDOUT, "Admin account created.\nEmail: {$email}\nGenerated password: {$password}\n\nStore this password securely. It will not be shown again.\n");
} catch (PDOException $error) {
    error_log('Admin creation failed: ' . $error->getMessage());
    fwrite(STDERR, "Could not create the admin. Confirm the migration was imported and the email is not already in use.\n");
    exit(1);
}
