<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'auth.php';

requireMethod('GET');
$user = requireAdmin();
jsonResponse(['status' => 'success', 'user' => $user, 'csrf_token' => csrfToken()]);
