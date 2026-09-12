<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/database.php';

try {
    $pageId = requireEnvironment('META_PAGE_ID');
    $token = requireEnvironment('META_PAGE_ACCESS_TOKEN');
    $version = requireEnvironment('META_GRAPH_API_VERSION');
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($pageId) . '/subscribed_apps?fields=subscribed_fields';
    $handle = curl_init($url);
    if ($handle === false) throw new RuntimeException('cURL initialization failed.');
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    echo 'http_status=' . $status . PHP_EOL;
    if (!is_string($response)) exit(1);
    $decoded = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
    if ($status >= 200 && $status < 300) {
        $fields = [];
        foreach (($decoded['data'] ?? []) as $subscription) {
            foreach (($subscription['subscribed_fields'] ?? []) as $field) {
                if (is_string($field) && preg_match('/\A[a-z0-9_]+\z/', $field)) $fields[$field] = true;
            }
        }
        ksort($fields);
        echo 'subscribed_fields=' . implode(',', array_keys($fields)) . PHP_EOL;
        exit;
    }
    echo 'graph_error_code=' . (int) ($decoded['error']['code'] ?? 0) . PHP_EOL;
    echo 'graph_error_type=' . preg_replace('/[^A-Za-z0-9_]/', '', (string) ($decoded['error']['type'] ?? 'unknown')) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Meta subscription check failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
