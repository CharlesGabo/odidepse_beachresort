<?php

declare(strict_types=1);

function loadEnvironment(string $filePath): void
{
    if (!is_file($filePath) || !is_readable($filePath)) {
        return;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        throw new RuntimeException('Unable to read the environment configuration.');
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        [$name, $value] = array_pad(explode('=', $line, 2), 2, '');
        $name = trim($name);
        $value = trim($value);

        if (preg_match('/\A[A-Z_][A-Z0-9_]*\z/', $name) !== 1) {
            continue;
        }

        if (
            strlen($value) >= 2
            && (($value[0] === '"' && str_ends_with($value, '"'))
                || ($value[0] === "'" && str_ends_with($value, "'")))
        ) {
            $value = substr($value, 1, -1);
        }

        $existing = getenv($name);
        if (($existing === false || $existing === '') && isset($_SERVER[$name]) && is_string($_SERVER[$name])) {
            $existing = $_SERVER[$name];
        }
        if (($existing === false || $existing === '') && isset($_ENV[$name]) && is_string($_ENV[$name])) {
            $existing = $_ENV[$name];
        }
        if ($existing !== false && $existing !== '') {
            $_ENV[$name] = $existing;
            continue;
        }

        $_ENV[$name] = $value;
        putenv("{$name}={$value}");
    }
}

function requireEnvironment(string $name): string
{
    $value = getenv($name);
    if (($value === false || $value === '') && isset($_SERVER[$name]) && is_string($_SERVER[$name])) {
        $value = $_SERVER[$name];
    }
    if (($value === false || $value === '') && isset($_ENV[$name]) && is_string($_ENV[$name])) {
        $value = $_ENV[$name];
    }
    if ($value === false || $value === '') {
        throw new RuntimeException("Required environment variable {$name} is not configured.");
    }

    return $value;
}
