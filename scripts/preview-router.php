<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$distRoot = realpath($projectRoot . DIRECTORY_SEPARATOR . 'dist');
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($distRoot !== false && ($requestPath === '/' || $requestPath === '/index.html')) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($distRoot . DIRECTORY_SEPARATOR . 'index.html');
    return;
}

if (is_string($requestPath) && preg_match('#\A/api/[A-Za-z0-9._/-]+\.php\z#', $requestPath) === 1) {
    $apiRoot = realpath($projectRoot . DIRECTORY_SEPARATOR . 'api');
    $requestedFile = realpath($projectRoot . str_replace('/', DIRECTORY_SEPARATOR, $requestPath));

    if (
        $apiRoot !== false
        && $requestedFile !== false
        && str_starts_with($requestedFile, $apiRoot . DIRECTORY_SEPARATOR)
        && is_file($requestedFile)
    ) {
        require $requestedFile;
        return;
    }
}

if ($distRoot !== false && is_string($requestPath)) {
    $requestedAsset = realpath($distRoot . str_replace('/', DIRECTORY_SEPARATOR, $requestPath));

    if (
        $requestedAsset !== false
        && str_starts_with($requestedAsset, $distRoot . DIRECTORY_SEPARATOR)
        && is_file($requestedAsset)
    ) {
        return false;
    }

    $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
    if (
        ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
        && str_contains($acceptHeader, 'text/html')
    ) {
        readfile($distRoot . DIRECTORY_SEPARATOR . 'index.html');
        return;
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo 'Not Found';
