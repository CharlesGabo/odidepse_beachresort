<?php
declare(strict_types=1);

require_once __DIR__ . '/facebook-automations.php';
require_once __DIR__ . '/stay-photos.php';

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

function workerClaimReply(PDO $db, array $eventIds = []): ?array
{
    $db->beginTransaction();
    try {
        $eventIds = array_values(array_unique(array_filter($eventIds, static fn(mixed $id): bool => is_int($id) && $id > 0)));
        $eventFilter = $eventIds === [] ? '' : ' AND j.event_id IN (' . implode(',', array_fill(0, count($eventIds), '?')) . ')';
        $query = $db->prepare("SELECT j.*, e.source, e.page_id, e.sender_id, e.guest_name, e.body, e.category, e.status AS event_status,
                TIMESTAMPDIFF(SECOND, e.last_customer_message_at, CURRENT_TIMESTAMP) AS message_age_seconds
            FROM facebook_jobs j
            INNER JOIN facebook_events e ON e.id = j.event_id
            WHERE j.kind IN ('reply','profile_fetch')
              AND (j.status = 'pending' OR (j.status = 'retry_wait' AND j.next_attempt_at <= CURRENT_TIMESTAMP))
              {$eventFilter}
            ORDER BY j.id ASC LIMIT 1 FOR UPDATE");
        $query->execute($eventIds);
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

function workerSendReply(array $job, string $pageId, string $token, string $version, int $timeout = 20): array
{
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($pageId) . '/messages';
    $message = trim((string) $job['payload']);
    $jobPayload = null;
    try { $jobPayload = json_decode($message, true, 8, JSON_THROW_ON_ERROR); } catch (JsonException) {}
    $isRoomPhoto = is_array($jobPayload) && ($jobPayload['__facebook_job_type'] ?? '') === 'room_photo';
    $isRoomCaption = is_array($jobPayload) && ($jobPayload['__facebook_job_type'] ?? '') === 'room_photo_caption';
    $isStaffReply = is_array($jobPayload) && ($jobPayload['__facebook_job_type'] ?? '') === 'staff_reply';
    $isHandoffReply = is_array($jobPayload) && ($jobPayload['__facebook_job_type'] ?? '') === 'handoff_reply';
    $isTakeoverNotice = is_array($jobPayload) && ($jobPayload['__facebook_job_type'] ?? '') === 'takeover_notice';
    if ($isRoomPhoto) {
        try { $photoPath = stayPhotoDeliveryPath((string) ($jobPayload['photo_id'] ?? '')); }
        catch (InvalidArgumentException) { return ['ok' => false, 'status' => 422, 'ambiguous' => false]; }
        $postFields = [
            'recipient' => json_encode(['id' => $job['sender_id']], JSON_THROW_ON_ERROR),
            'messaging_type' => 'RESPONSE',
            'message' => json_encode(['attachment' => ['type' => 'image', 'payload' => ['is_reusable' => true]]], JSON_THROW_ON_ERROR),
            'filedata' => new CURLFile($photoPath, 'image/jpeg', basename($photoPath)),
        ];
    } else {
        if ($isRoomCaption || $isStaffReply || $isHandoffReply || $isTakeoverNotice) $message = trim((string) ($jobPayload['text'] ?? ''));
        $notice = facebookAutomaticReplyNotice();
        if (!$isRoomCaption && !$isStaffReply && !$isHandoffReply && !$isTakeoverNotice && !str_contains($message, $notice)) $message .= "\n\n" . $notice;
        $postFields = json_encode([
            'recipient' => ['id' => $job['sender_id']],
            'messaging_type' => 'RESPONSE',
            'message' => ['text' => $message],
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    $handle = curl_init($url);
    if ($handle === false) throw new RuntimeException('Could not initialize Meta delivery.');
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => min(5, max(1, $timeout)),
        CURLOPT_TIMEOUT => max(1, $timeout),
        CURLOPT_HTTPHEADER => $isRoomPhoto ? ['Authorization: Bearer ' . $token] : ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $postFields,
    ]);
    $response = curl_exec($handle);
    $curlError = curl_errno($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if ($response === false || $curlError !== 0) return ['ok' => false, 'status' => 0, 'ambiguous' => true];
    try { $decoded = json_decode($response, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { return ['ok' => false, 'status' => $status, 'ambiguous' => $status >= 200 && $status < 300]; }
    return [
        'ok' => $status >= 200 && $status < 300 && is_string($decoded['message_id'] ?? null),
        'status' => $status,
        'ambiguous' => false,
        'room_photo' => $isRoomPhoto,
        'photo_index' => $isRoomPhoto ? (int) ($jobPayload['photo_index'] ?? 0) : null,
        'photo_total' => $isRoomPhoto ? (int) ($jobPayload['photo_total'] ?? 0) : null,
    ];
}

function workerFetchSenderProfile(string $senderId, string $token, string $version, int $timeout = 10): array
{
    $url = 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($senderId) . '?fields=name';
    $handle = curl_init($url);
    if ($handle === false) return ['ok' => false, 'status' => 0, 'name' => null];
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => min(5, max(1, $timeout)),
        CURLOPT_TIMEOUT => max(1, $timeout),
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

function facebookRunDeliveryWorker(array $eventIds = [], int $maximumJobs = 10, float $maximumSeconds = 0.0): int
{
    try {
    if (!extension_loaded('curl')) throw new RuntimeException('The PHP cURL extension is required.');
    $pageId = requireEnvironment('META_PAGE_ID');
    $token = requireEnvironment('META_PAGE_ACCESS_TOKEN');
    $version = requireEnvironment('META_GRAPH_API_VERSION');
    if (preg_match('/\Av[0-9]{1,2}\.[0-9]\z/', $version) !== 1) throw new RuntimeException('META_GRAPH_API_VERSION is invalid.');
    $db = database();
    $processed = 0;
    $startedAt = microtime(true);
    while ($processed < max(1, min(10, $maximumJobs))
        && ($maximumSeconds <= 0 || microtime(true) - $startedAt < $maximumSeconds)
        && ($job = workerClaimReply($db, $eventIds)) !== null) {
        $processed++;
        $remainingSeconds = $maximumSeconds > 0 ? max(1, (int) ceil($maximumSeconds - (microtime(true) - $startedAt))) : 20;
        $messageAge = filter_var($job['message_age_seconds'], FILTER_VALIDATE_INT);
        $withinWindow = $messageAge !== false && $messageAge >= 0 && $messageAge <= 86400;
        $validSender = $job['source'] === 'facebook' && hash_equals($pageId, (string) $job['page_id']) && is_string($job['sender_id']) && $job['sender_id'] !== '';
        if ($job['kind'] === 'profile_fetch') {
            if (!$validSender) {
                workerFailJob($db, (int) $job['id'], 'ineligible_profile');
                continue;
            }
            $profileTimeout = $maximumSeconds > 0 ? min(3, $remainingSeconds) : min(10, $remainingSeconds);
            $profile = workerFetchSenderProfile($job['sender_id'], $token, $version, $profileTimeout);
            if (!$profile['ok']) {
                $profileStatus = (int) $profile['status'];
                facebookRecordFailure($db, (int) $job['id'], $profileStatus, $profileStatus === 0 || $profileStatus === 429 || $profileStatus >= 500);
                continue;
            }
            $db->beginTransaction();
            if ($profile['name'] !== null) {
                $query = $db->prepare("UPDATE facebook_events SET guest_name = ?, revision = revision + 1 WHERE page_id = ? AND sender_id = ? AND kind = 'message' AND guest_name <> ?");
                $query->execute([$profile['name'], $job['page_id'], $job['sender_id'], $profile['name']]);
                $conversationQuery = $db->prepare('SELECT id, data_json, booking_id FROM facebook_conversations WHERE page_id = ? AND sender_id = ? FOR UPDATE');
                $conversationQuery->execute([$job['page_id'], $job['sender_id']]);
                $conversation = $conversationQuery->fetch();
                if ($conversation) {
                    try { $conversationData = json_decode((string) $conversation['data_json'], true, 32, JSON_THROW_ON_ERROR); }
                    catch (JsonException) { $conversationData = []; }
                    if (!is_array($conversationData)) $conversationData = [];
                    $previousName = is_string($conversationData['guest_name'] ?? null) ? trim($conversationData['guest_name']) : '';
                    $customerProvidedName = ($conversationData['guest_name_source'] ?? '') === 'customer' && $previousName !== '';
                    if (!$customerProvidedName) {
                        $conversationData['guest_name'] = $profile['name'];
                        $conversationData['guest_name_source'] = 'facebook_profile';
                    }
                    $conversationData['facebook_profile_name'] = $profile['name'];
                    $encodedData = json_encode($conversationData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                    $db->prepare('UPDATE facebook_conversations SET data_json = ?, revision = revision + 1 WHERE id = ?')->execute([$encodedData, $conversation['id']]);
                    if ($conversation['booking_id'] !== null) {
                        $bookingName = $customerProvidedName ? $previousName : $profile['name'];
                        $db->prepare("UPDATE bookings SET guest_name = ? WHERE id = ? AND status = 'pending'")->execute([$bookingName, $conversation['booking_id']]);
                    }
                }
                $pendingReply = $db->prepare("SELECT id, payload FROM facebook_jobs WHERE event_id = ? AND kind = 'reply' AND dedupe_key = ? AND status IN ('pending','retry_wait') LIMIT 1 FOR UPDATE");
                $pendingReply->execute([(int) $job['event_id'], 'reply:event:' . (int) $job['event_id']]);
                $pendingReplyJob = $pendingReply->fetch();
                if ($pendingReplyJob && str_contains((string) $pendingReplyJob['payload'], 'Name: Needed')) {
                    $pendingReplyId = (int) $pendingReplyJob['id'];
                    $rules = facebookSettings($db)['rules'];
                    $reply = facebookConversationReply($db, [
                        'id' => (int) $job['event_id'],
                        'page_id' => $job['page_id'],
                        'sender_id' => $job['sender_id'],
                        'guest_name' => $profile['name'],
                        'body' => $job['body'],
                        'category' => $job['category'],
                    ], $rules);
                    if ($reply === '') {
                        $db->prepare("UPDATE facebook_jobs SET status = 'cancelled', error_code = 'reply_no_longer_needed' WHERE id = ?")->execute([$pendingReplyId]);
                    } else {
                        $includeAutomaticNotice = trim($reply) !== trim(facebookConversationPrompt('handoff', $rules));
                        $payload = $includeAutomaticNotice
                            ? trim($reply) . (str_contains($reply, facebookAutomaticReplyNotice()) ? '' : "\n\n" . facebookAutomaticReplyNotice())
                            : json_encode(['__facebook_job_type' => 'handoff_reply', 'text' => trim($reply)], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                        $db->prepare("UPDATE facebook_jobs SET payload = ?, status = 'pending', attempts = 0, next_attempt_at = NULL, error_code = NULL WHERE id = ?")->execute([$payload, $pendingReplyId]);
                        $photoCount = facebookQueueNativeRoomPhotos($db, (int) $job['event_id'], (string) $job['page_id'], (string) $job['sender_id']);
                        if ($photoCount > 0) facebookAudit($db, null, 'suggested_room_photos_queued', 'event', (int) $job['event_id']);
                    }
                }
                facebookAudit($db, null, 'sender_name_resolved', 'event', (int) $job['event_id']);
            }
            $db->prepare("UPDATE facebook_jobs SET status = 'succeeded', error_code = NULL WHERE id = ? AND status = 'processing'")->execute([(int) $job['id']]);
            $db->commit();
            continue;
        }
        if (!$validSender || !$withinWindow || $job['event_status'] === 'resolved') {
            workerFailJob($db, (int) $job['id'], 'ineligible_reply');
            continue;
        }
        $result = workerSendReply($job, $pageId, $token, $version, min(20, $remainingSeconds));
        if (!$result['ok']) {
            facebookRecordFailure($db, (int) $job['id'], (int) $result['status'], (int) $result['status'] === 429 || (int) $result['status'] >= 500, (bool) $result['ambiguous']);
            continue;
        }
        $db->beginTransaction();
        $db->prepare("UPDATE facebook_jobs SET status = 'succeeded', error_code = NULL WHERE id = ? AND status = 'processing'")->execute([(int) $job['id']]);
        if (!empty($result['room_photo'])) {
            $nextIndex = (int) $result['photo_index'] + 1;
            if ($nextIndex < (int) $result['photo_total']) {
                $nextKey = 'room-photo:event:' . (int) $job['event_id'] . ':' . $nextIndex;
                $db->prepare("UPDATE facebook_jobs SET status = 'pending', error_code = NULL WHERE event_id = ? AND dedupe_key = ? AND status = 'blocked' AND error_code = 'awaiting_previous_photo'")
                    ->execute([(int) $job['event_id'], $nextKey]);
            } else {
                $captionKey = 'room-photo-caption:event:' . (int) $job['event_id'];
                $db->prepare("UPDATE facebook_jobs SET status = 'pending', error_code = NULL WHERE event_id = ? AND dedupe_key = ? AND status = 'blocked' AND error_code = 'awaiting_photos'")
                    ->execute([(int) $job['event_id'], $captionKey]);
            }
        }
        $db->prepare("UPDATE facebook_events SET status = 'in_progress', revision = revision + 1 WHERE id = ? AND status = 'new'")->execute([(int) $job['event_id']]);
        $sentPayload = null;
        try { $sentPayload = json_decode((string) $job['payload'], true, 8, JSON_THROW_ON_ERROR); } catch (JsonException) {}
        $sentByStaff = is_array($sentPayload) && ($sentPayload['__facebook_job_type'] ?? '') === 'staff_reply';
        $sentTakeoverNotice = is_array($sentPayload) && ($sentPayload['__facebook_job_type'] ?? '') === 'takeover_notice';
        if ($sentTakeoverNotice && is_string($sentPayload['release_dedupe_key'] ?? null)) {
            $db->prepare("UPDATE facebook_jobs SET status = 'pending', error_code = NULL WHERE dedupe_key = ? AND status = 'blocked' AND error_code = 'awaiting_takeover_notice'")->execute([$sentPayload['release_dedupe_key']]);
        }
        if ($sentByStaff) facebookStartHumanTakeover($db, (string) $job['page_id'], (string) $job['sender_id'], (int) $job['event_id']);
        facebookAudit($db, null, $sentByStaff ? 'staff_reply_sent' : ($sentTakeoverNotice ? 'takeover_notice_sent' : 'automatic_reply_sent'), 'event', (int) $job['event_id']);
        $db->commit();
    }
    return $processed;
    } catch (Throwable $error) {
        if (isset($db) && $db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

if (PHP_SAPI === 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        $processed = facebookRunDeliveryWorker();
        echo 'Facebook worker completed. Jobs processed: ' . $processed . PHP_EOL;
    } catch (Throwable $error) {
        fwrite(STDERR, 'Facebook worker failed: ' . get_class($error) . PHP_EOL);
        exit(1);
    }
}
