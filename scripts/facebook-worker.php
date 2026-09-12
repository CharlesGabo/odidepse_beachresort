<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/includes/facebook-automations.php';

function workerFailJob(PDO $db, int $jobId, string $code): void
{
    $db->beginTransaction();
    try {
        $query = $db->prepare("UPDATE facebook_jobs SET status = 'failed', next_attempt_at = NULL, error_code = ? WHERE id = ? AND status = 'processing'");
        $query->execute([$code, $jobId]);
        if ($query->rowCount()) facebookAudit($db, null, 'failed', 'job', $jobId);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function workerClaimReply(PDO $db): ?array
{
    $db->beginTransaction();
    try {
        $query = $db->query("SELECT j.*, e.source, e.page_id, e.sender_id, e.guest_name, e.category, e.status AS event_status,
                TIMESTAMPDIFF(SECOND, e.last_customer_message_at, CURRENT_TIMESTAMP) AS message_age_seconds
            FROM facebook_jobs j
            INNER JOIN facebook_events e ON e.id = j.event_id
            WHERE j.kind IN ('reply','profile_fetch')
              AND (j.status = 'pending' OR (j.status = 'retry_wait' AND j.next_attempt_at <= CURRENT_TIMESTAMP))
            ORDER BY j.id ASC LIMIT 1 FOR UPDATE");
        $job = $query->fetch();
        if (!$job) { $db->commit(); return null; }
        $update = $db->prepare("UPDATE facebook_jobs SET status = 'processing', attempts = attempts + 1, next_attempt_at = NULL, error_code = NULL WHERE id = ? AND status IN ('pending','retry_wait')");
        $update->execute([(int) $job['id']]);
        if (!$update->rowCount()) { $db->rollBack(); return null; }
        $job['attempts'] = (int) $job['attempts'] + 1;
        $db->commit();
        return $job;
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function workerSendReply(array $job, string $pageId, string $token, string $version): array
{
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($pageId) . '/messages';
    $payload = json_encode([
        'recipient' => ['id' => $job['sender_id']],
        'messaging_type' => 'RESPONSE',
        'message' => ['text' => $job['payload']],
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $handle = curl_init($url);
    if ($handle === false) throw new RuntimeException('Could not initialize Meta delivery.');
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $response = curl_exec($handle);
    $curlError = curl_errno($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if ($response === false || $curlError !== 0) return ['ok' => false, 'status' => 0, 'ambiguous' => true];
    try { $decoded = json_decode($response, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { return ['ok' => false, 'status' => $status, 'ambiguous' => $status >= 200 && $status < 300]; }
    return ['ok' => $status >= 200 && $status < 300 && is_string($decoded['message_id'] ?? null), 'status' => $status, 'ambiguous' => false];
}

function workerFetchSenderProfile(string $senderId, string $token, string $version): array
{
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($senderId) . '?fields=name';
    $handle = curl_init($url);
    if ($handle === false) return ['ok' => false, 'status' => 0, 'name' => null];
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    ]);
    $response = curl_exec($handle);
    $curlError = curl_errno($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if (!is_string($response) || $curlError !== 0 || $status < 200 || $status >= 300) return ['ok' => false, 'status' => $status, 'name' => null];
    try { $profile = json_decode($response, true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException) { return ['ok' => false, 'status' => $status, 'name' => null]; }
    return ['ok' => is_array($profile), 'status' => $status, 'name' => is_array($profile) ? facebookProfileName($profile) : null];
}

try {
    if (!extension_loaded('curl')) throw new RuntimeException('The PHP cURL extension is required.');
    $pageId = requireEnvironment('META_PAGE_ID');
    $token = requireEnvironment('META_PAGE_ACCESS_TOKEN');
    $version = requireEnvironment('META_GRAPH_API_VERSION');
    if (preg_match('/\Av[0-9]{1,2}\.[0-9]\z/', $version) !== 1) throw new RuntimeException('META_GRAPH_API_VERSION is invalid.');
    $db = database();
    $processed = 0;
    while ($processed < 10 && ($job = workerClaimReply($db)) !== null) {
        $processed++;
        $messageAge = filter_var($job['message_age_seconds'], FILTER_VALIDATE_INT);
        $withinWindow = $messageAge !== false && $messageAge >= 0 && $messageAge <= 86400;
        $validSender = $job['source'] === 'facebook' && hash_equals($pageId, (string) $job['page_id']) && is_string($job['sender_id']) && $job['sender_id'] !== '';
        if ($job['kind'] === 'profile_fetch') {
            if (!$validSender) {
                workerFailJob($db, (int) $job['id'], 'ineligible_profile');
                continue;
            }
            $profile = workerFetchSenderProfile($job['sender_id'], $token, $version);
            if (!$profile['ok']) {
                $profileStatus = (int) $profile['status'];
                facebookRecordFailure($db, (int) $job['id'], $profileStatus, $profileStatus === 0 || $profileStatus === 429 || $profileStatus >= 500);
                continue;
            }
            $db->beginTransaction();
            if ($profile['name'] !== null) {
                $query = $db->prepare("UPDATE facebook_events SET guest_name = ?, revision = revision + 1 WHERE id = ? AND guest_name = 'Messenger guest'");
                $query->execute([$profile['name'], (int) $job['event_id']]);
                if ($query->rowCount()) facebookAudit($db, null, 'sender_name_resolved', 'event', (int) $job['event_id']);
            }
            $db->prepare("UPDATE facebook_jobs SET status = 'succeeded', error_code = NULL WHERE id = ? AND status = 'processing'")->execute([(int) $job['id']]);
            $db->commit();
            continue;
        }
        if (!$validSender || !$withinWindow || $job['event_status'] === 'resolved' || $job['category'] === 'complaint') {
            workerFailJob($db, (int) $job['id'], 'ineligible_reply');
            continue;
        }
        $result = workerSendReply($job, $pageId, $token, $version);
        if (!$result['ok']) {
            facebookRecordFailure($db, (int) $job['id'], (int) $result['status'], (int) $result['status'] === 429 || (int) $result['status'] >= 500, (bool) $result['ambiguous']);
            continue;
        }
        $db->beginTransaction();
        $db->prepare("UPDATE facebook_jobs SET status = 'succeeded', error_code = NULL WHERE id = ? AND status = 'processing'")->execute([(int) $job['id']]);
        $db->prepare("UPDATE facebook_events SET status = 'in_progress', revision = revision + 1 WHERE id = ? AND status = 'new'")->execute([(int) $job['event_id']]);
        facebookAudit($db, null, 'automatic_reply_sent', 'event', (int) $job['event_id']);
        $db->commit();
    }
    echo 'Facebook worker completed. Jobs processed: ' . $processed . PHP_EOL;
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Facebook worker failed: ' . get_class($error) . PHP_EOL);
    exit(1);
}
