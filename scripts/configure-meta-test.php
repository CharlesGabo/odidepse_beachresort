<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$path = dirname(__DIR__) . '/.env';
if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
    fwrite(STDERR, "The ignored local .env file must exist and be writable.\n");
    exit(1);
}
$contents = file_get_contents($path);
if ($contents === false) { fwrite(STDERR, "Could not read the local environment file.\n"); exit(1); }
if (preg_match('/^META_WEBHOOK_VERIFY_TOKEN=\S+/m', $contents) === 1) {
    echo "A local Meta webhook verification token is already configured. Its value was not displayed.\n";
    exit(0);
}
$separator = $contents === '' || str_ends_with($contents, "\n") ? '' : PHP_EOL;
$addition = $separator . PHP_EOL . '# Meta test connection (server-side only)' . PHP_EOL
    . 'META_WEBHOOK_VERIFY_TOKEN=' . bin2hex(random_bytes(32)) . PHP_EOL;
if (file_put_contents($path, $addition, FILE_APPEND | LOCK_EX) === false) {
    fwrite(STDERR, "Could not update the local environment file.\n");
    exit(1);
}
echo "A random Meta webhook verification token was added to the ignored local .env. Its value was not displayed.\n";
