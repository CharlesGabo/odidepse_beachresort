<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/api.php';
require_once dirname(__DIR__) . '/includes/database.php';
require_once dirname(__DIR__) . '/includes/facebook-automations.php';

function webhookEnvironment(string $name): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        throw new RuntimeException('Meta webhook configuration is incomplete.');
    }
    return $value;
}

function webhookPlain(string $body, int $status): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
}

function webhookTimestamp(mixed $milliseconds): string
{
    $numeric = is_int($milliseconds) || is_float($milliseconds) ? (int) $milliseconds : 0;
    $seconds = $numeric > 100000000000 ? (int) floor($numeric / 1000) : $numeric;
    if ($seconds < 946684800 || $seconds > time() + 86400) $seconds = time();
    return gmdate('Y-m-d H:i:s', $seconds);
}

function webhookInsertEvent(PDO $db, array $event, array $rules): ?int
{
    $query = $db->prepare("INSERT IGNORE INTO facebook_events (source, external_id, page_id, sender_id, kind, guest_name, email, phone, body, last_customer_message_at, category, needs_attention, received_at) VALUES ('facebook', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $query->execute([
        $event['external_id'], $event['page_id'], $event['sender_id'], $event['kind'], $event['guest_name'],
        $event['email'] ?? '', $event['phone'] ?? '', $event['body'], $event['last_customer_message_at'] ?? null,
        $event['category'], (int) $event['needs_attention'], $event['received_at'],
    ]);
    if ($query->rowCount() !== 1) return null;
    $id = (int) $db->lastInsertId();
    facebookAudit($db, null, 'webhook_received', 'event', $id);
    if ($event['needs_attention']) facebookAudit($db, null, 'staff_alert_created', 'event', $id);
    if ($event['kind'] === 'message' && is_string($event['sender_id']) && $event['sender_id'] !== '') {
        $db->prepare("INSERT INTO facebook_jobs (event_id, kind, dedupe_key, payload, status) VALUES (?, 'profile_fetch', ?, '', 'pending')")
            ->execute([$id, 'profile:event:' . $id]);
        facebookAudit($db, null, 'sender_name_queued', 'event', $id);
    }
    if (($rules['prepare_replies'] ?? false) && $event['kind'] === 'message') {
        if (facebookPrepareReply($db, ['id' => $id, 'kind' => 'message', 'category' => $event['category'], 'status' => 'new'], $rules, true)) {
            facebookAudit($db, null, 'automatic_reply_queued', 'event', $id);
        }
    }
    return $id;
}

function webhookProcessPayload(PDO $db, array $payload, string $pageId): void
{
    if (($payload['object'] ?? null) !== 'page' || !is_array($payload['entry'] ?? null)) return;
    $rules = facebookSettings($db)['rules'];
    foreach ($payload['entry'] as $entry) {
        if (!is_array($entry) || (string) ($entry['id'] ?? '') !== $pageId) continue;
        foreach (($entry['messaging'] ?? []) as $messageEvent) {
            if (!is_array($messageEvent) || !empty($messageEvent['message']['is_echo'])) continue;
            $message = $messageEvent['message'] ?? null;
            $senderId = (string) ($messageEvent['sender']['id'] ?? '');
            $mid = is_array($message) ? (string) ($message['mid'] ?? '') : '';
            $body = is_array($message) && is_string($message['text'] ?? null) ? trim($message['text']) : '';
            if ($senderId === '' || $mid === '' || $body === '') continue;
            $receivedAt = webhookTimestamp($messageEvent['timestamp'] ?? null);
            $category = facebookCategory($body, (bool) ($rules['categorize'] ?? true), $rules['keywords'] ?? null);
            webhookInsertEvent($db, [
                'external_id' => $mid, 'page_id' => $pageId, 'sender_id' => $senderId, 'kind' => 'message',
                'guest_name' => 'Messenger guest', 'body' => mb_substr($body, 0, 4000),
                'last_customer_message_at' => $receivedAt, 'category' => $category,
                'needs_attention' => $category === 'complaint', 'received_at' => $receivedAt,
            ], $rules);
        }
        foreach (($entry['changes'] ?? []) as $change) {
            if (!is_array($change) || !is_array($change['value'] ?? null)) continue;
            $field = (string) ($change['field'] ?? '');
            $value = $change['value'];
            if ($field === 'feed' && ($value['item'] ?? '') === 'comment') {
                $commentId = (string) ($value['comment_id'] ?? '');
                if ($commentId === '') continue;
                if (($value['verb'] ?? '') === 'remove') {
                    $query = $db->prepare("UPDATE facebook_events SET website_status = 'hidden', website_published_at = NULL, status = 'resolved', needs_attention = 0, revision = revision + 1 WHERE kind = 'comment' AND external_id = ? AND page_id = ?");
                    $query->execute([$commentId, $pageId]);
                    if ($query->rowCount()) facebookAudit($db, null, 'comment_removed', 'event', null);
                    continue;
                }
                $body = is_string($value['message'] ?? null) ? trim($value['message']) : '';
                if ($body === '') continue;
                $category = facebookCategory($body, (bool) ($rules['categorize'] ?? true), $rules['keywords'] ?? null);
                if (($value['verb'] ?? '') === 'edited') {
                    $query = $db->prepare("UPDATE facebook_events SET guest_name = ?, body = ?, category = ?, status = 'new', needs_attention = 1, website_status = 'hidden', website_published_at = NULL, revision = revision + 1 WHERE kind = 'comment' AND external_id = ? AND page_id = ?");
                    $query->execute([cleanText($value['from']['name'] ?? 'Facebook guest', 100) ?: 'Facebook guest', mb_substr($body, 0, 4000), $category, $commentId, $pageId]);
                    if ($query->rowCount()) {
                        facebookAudit($db, null, 'comment_edited_hidden', 'event', null);
                        continue;
                    }
                }
                webhookInsertEvent($db, [
                    'external_id' => $commentId, 'page_id' => $pageId, 'sender_id' => (string) ($value['from']['id'] ?? ''),
                    'kind' => 'comment', 'guest_name' => cleanText($value['from']['name'] ?? 'Facebook guest', 100) ?: 'Facebook guest',
                    'body' => mb_substr($body, 0, 4000), 'category' => $category,
                    'needs_attention' => (bool) ($rules['notify_comments'] ?? true) || $category === 'complaint',
                    'received_at' => webhookTimestamp($entry['time'] ?? null),
                ], $rules);
            }
            if ($field === 'leadgen') {
                $leadId = (string) ($value['leadgen_id'] ?? '');
                if ($leadId === '') continue;
                $eventId = webhookInsertEvent($db, [
                    'external_id' => $leadId, 'page_id' => $pageId, 'sender_id' => null, 'kind' => 'lead',
                    'guest_name' => 'Facebook lead', 'body' => 'Lead details are waiting to be retrieved from Meta.',
                    'category' => 'booking', 'needs_attention' => true,
                    'received_at' => webhookTimestamp($value['created_time'] ?? ($entry['time'] ?? null)),
                ], $rules);
                if ($eventId !== null) {
                    $payloadJson = json_encode(['leadgen_id' => $leadId, 'form_id' => (string) ($value['form_id'] ?? '')], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                    $db->prepare("INSERT INTO facebook_jobs (event_id, kind, dedupe_key, payload, status, error_code) VALUES (?, 'lead_fetch', ?, ?, 'blocked', 'connection_pending')")->execute([$eventId, 'lead_fetch:' . $leadId, $payloadJson]);
                    facebookAudit($db, null, 'lead_fetch_prepared', 'event', $eventId);
                }
            }
        }
    }
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'GET') {
    try {
        $mode = (string) ($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
        $provided = (string) ($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
        $challenge = (string) ($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
        $expected = webhookEnvironment('META_WEBHOOK_VERIFY_TOKEN');
        if ($mode !== 'subscribe' || $provided === '' || $challenge === '' || !hash_equals($expected, $provided)) webhookPlain('Forbidden', 403);
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? 'unknown'));
        if (preg_match('/\A[a-z0-9.-]+(?::[0-9]{1,5})?\z/', $host) !== 1 || strlen($host) > 255) $host = 'unknown';
        $db = database();
        $db->prepare('INSERT INTO facebook_webhook_state (id, verified_host) VALUES (1, ?) ON DUPLICATE KEY UPDATE verified_host = VALUES(verified_host), verified_at = CURRENT_TIMESTAMP')->execute([$host]);
        facebookAudit($db, null, 'webhook_verified', 'connection', 1);
        webhookPlain($challenge, 200);
    } catch (Throwable) {
        webhookPlain('Webhook is not configured.', 503);
    }
}
if ($method !== 'POST') {
    header('Allow: GET, POST');
    webhookPlain('Method not allowed.', 405);
}

$raw = file_get_contents('php://input', false, null, 0, 1048577);
if ($raw === false || strlen($raw) > 1048576) webhookPlain('Invalid request.', 400);
try {
    $secret = webhookEnvironment('META_APP_SECRET');
    $pageId = webhookEnvironment('META_PAGE_ID');
    $providedSignature = strtolower((string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? ''));
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $raw, $secret);
    if ($providedSignature === '' || !hash_equals($expectedSignature, $providedSignature)) webhookPlain('Invalid signature.', 403);
    $payload = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) webhookPlain('Invalid request.', 400);
    $db = database();
    $db->beginTransaction();
    webhookProcessPayload($db, $payload, $pageId);
    $db->commit();
    webhookPlain('EVENT_RECEIVED', 200);
} catch (JsonException) {
    webhookPlain('Invalid request.', 400);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('Meta webhook processing failed: ' . get_class($error));
    webhookPlain('Temporary failure.', 500);
}
