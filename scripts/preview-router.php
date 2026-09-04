<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($requestPath === '/' || $requestPath === '/index.php') {
    require $projectRoot . DIRECTORY_SEPARATOR . 'index.php';
    return;
}

if (is_string($requestPath) && preg_match('#\A/assets/[A-Za-z0-9._/-]+\.(?:css|js|gif|ico|jpe?g|png|svg|webp|woff2?)\z#i', $requestPath) === 1) {
    $assetsRoot = realpath($projectRoot . DIRECTORY_SEPARATOR . 'assets');
    $requestedAsset = realpath($projectRoot . str_replace('/', DIRECTORY_SEPARATOR, $requestPath));

    if (
        $assetsRoot !== false
        && $requestedAsset !== false
        && str_starts_with($requestedAsset, $assetsRoot . DIRECTORY_SEPARATOR)
        && is_file($requestedAsset)
    ) {
        return false;
    }
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

http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo 'Not Found';
