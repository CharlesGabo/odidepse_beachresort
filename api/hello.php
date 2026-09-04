<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

try {
    require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'database.php';
    database()->query('SELECT 1')->fetchColumn();

    echo json_encode([
        'status' => 'success',
        'message' => 'PHP and the Odidepse database are connected.',
    ]);
} catch (Throwable $error) {
    error_log('Database health check failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'The database connection is unavailable.',
    ]);
}
