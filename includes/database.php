<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'environment.php';

loadEnvironment(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

function database(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $host = requireEnvironment('DB_HOST');
    $port = filter_var(requireEnvironment('DB_PORT'), FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 65535],
    ]);

    if ($port === false) {
        throw new RuntimeException('DB_PORT must be a valid port number.');
    }

    $databaseName = requireEnvironment('DB_NAME');
    if (preg_match('/\A[A-Za-z0-9_]+\z/', $databaseName) !== 1) {
        throw new RuntimeException('DB_NAME contains unsupported characters.');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $host,
        $port,
        $databaseName,
    );

    $connection = new PDO(
        $dsn,
        requireEnvironment('DB_USER'),
        requireEnvironment('DB_PASSWORD'),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    );

    return $connection;
}
