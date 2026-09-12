<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/database.php';

try {
    $pageId = requireEnvironment('META_PAGE_ID');
    $token = requireEnvironment('META_PAGE_ACCESS_TOKEN');
    $version = requireEnvironment('META_GRAPH_API_VERSION');
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/me?fields=id,name';
    $handle = curl_init($url);
    if ($handle === false) throw new RuntimeException('cURL initialization failed.');
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    ]);
    $response = curl_exec($handle);
    $curlCode = curl_errno($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    echo 'http_status=' . $status . PHP_EOL;
    echo 'curl_code=' . $curlCode . PHP_EOL;
    if (is_string($response)) {
        $decoded = json_decode($response, true);
        if (is_array($decoded) && isset($decoded['id']) && hash_equals($pageId, (string) $decoded['id'])) {
            echo 'page_identity=verified' . PHP_EOL;
        } elseif (is_array($decoded['error'] ?? null)) {
            echo 'graph_error_code=' . (int) ($decoded['error']['code'] ?? 0) . PHP_EOL;
            echo 'graph_error_type=' . preg_replace('/[^A-Za-z0-9_]/', '', (string) ($decoded['error']['type'] ?? 'unknown')) . PHP_EOL;
            $safeMessage = preg_replace('/[^A-Za-z0-9 .,_()\/-]/', '', (string) ($decoded['error']['message'] ?? ''));
            echo 'graph_error_message=' . mb_substr($safeMessage ?? '', 0, 300) . PHP_EOL;
        }
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Meta connection check failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
