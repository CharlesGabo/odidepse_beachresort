<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/database.php';

try {
    $appId = requireEnvironment('META_APP_ID');
    $appSecret = requireEnvironment('META_APP_SECRET');
    $pageToken = requireEnvironment('META_PAGE_ACCESS_TOKEN');
    $version = requireEnvironment('META_GRAPH_API_VERSION');
    $handle = curl_init('https://graph.facebook.com/' . rawurlencode($version) . '/debug_token');
    if ($handle === false) throw new RuntimeException('cURL initialization failed.');
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_POSTFIELDS => http_build_query(['input_token' => $pageToken, 'access_token' => $appId . '|' . $appSecret]),
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    echo 'http_status=' . $status . PHP_EOL;
    if (!is_string($response)) exit(1);
    $decoded = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
    if (is_array($decoded['error'] ?? null)) {
        echo 'graph_error_code=' . (int) ($decoded['error']['code'] ?? 0) . PHP_EOL;
        echo 'graph_error_subcode=' . (int) ($decoded['error']['error_subcode'] ?? 0) . PHP_EOL;
        echo 'graph_error_type=' . preg_replace('/[^A-Za-z0-9_]/', '', (string) ($decoded['error']['type'] ?? 'unknown')) . PHP_EOL;
    }
    $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
    echo 'token_valid=' . (!empty($data['is_valid']) ? 'yes' : 'no') . PHP_EOL;
    echo 'correct_app=' . (isset($data['app_id']) && hash_equals($appId, (string) $data['app_id']) ? 'yes' : 'no') . PHP_EOL;
    $scopes = array_values(array_filter($data['scopes'] ?? [], static fn ($scope) => is_string($scope) && preg_match('/\A[a-z0-9_]+\z/', $scope)));
    sort($scopes);
    echo 'scopes=' . implode(',', $scopes) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Meta token scope check failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
