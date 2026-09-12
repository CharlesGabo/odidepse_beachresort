<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$version = $argv[1] ?? '';
if (!is_string($version) || preg_match('/\Av[0-9]{1,2}\.[0-9]\z/', $version) !== 1) {
    fwrite(STDERR, "Usage: php scripts/set-meta-api-version.php v26.0\n");
    exit(1);
}

$path = dirname(__DIR__) . '/.env';
if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
    fwrite(STDERR, "The ignored local .env file must exist and be writable.\n");
    exit(1);
}
$contents = file_get_contents($path);
if ($contents === false) { fwrite(STDERR, "Could not read the local environment file.\n"); exit(1); }

$line = 'META_GRAPH_API_VERSION=' . $version;
if (preg_match('/^META_GRAPH_API_VERSION=.*$/m', $contents) === 1) {
    $updated = preg_replace('/^META_GRAPH_API_VERSION=.*$/m', $line, $contents, 1);
} else {
    $separator = $contents === '' || str_ends_with($contents, "\n") ? '' : PHP_EOL;
    $updated = $contents . $separator . $line . PHP_EOL;
}
if (!is_string($updated) || file_put_contents($path, $updated, LOCK_EX) === false) {
    fwrite(STDERR, "Could not update the local environment file.\n");
    exit(1);
}
echo "The local Meta Graph API version is now {$version}.\n";
