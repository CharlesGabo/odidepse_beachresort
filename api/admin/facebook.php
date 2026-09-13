<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/facebook-automations.php';
$method = requireMethod('GET', 'POST');
$admin = requireAdmin();
if ($method === 'POST') requireCsrfToken();

try {
    $db = database();
    if ($method === 'GET') {
        $settings = facebookSettings($db);
        $section = (string) ($_GET['section'] ?? 'message');
        $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100000]]);
        if ($page === false || !in_array($section, ['message', 'comment', 'lead', 'alerts', 'drafts', 'jobs', 'audit', 'rules'], true)) throw new FacebookWorkflowError('Choose a valid section and page.');
        $offset = ($page - 1) * 25;
        $records = [];
        $total = 0;
        if (in_array($section, ['message', 'comment', 'lead', 'alerts'], true)) {
            $where = $section === 'alerts' ? 'e.needs_attention = 1' : 'e.kind = ?';
            $params = $section === 'alerts' ? [] : [$section];
            $query = $db->prepare('SELECT e.*, UNIX_TIMESTAMP(e.received_at) AS received_epoch,
                b.reference_code,
                b.guest_name AS booking_guest_name,
                b.email AS booking_email,
                b.phone AS booking_phone,
                b.check_in AS booking_check_in,
                b.check_out AS booking_check_out,
                b.guests AS booking_guests,
                b.stay_type AS booking_stay_type,
                b.status AS booking_status
                FROM facebook_events e
                LEFT JOIN bookings b ON b.id = e.booking_id
                WHERE ' . $where . ' ORDER BY e.id DESC LIMIT 25 OFFSET ' . $offset);
            $query->execute($params); $records = $query->fetchAll();
            if ($section === 'message' && $records !== []) {
                $ids = array_column($records, 'id');
                $replies = $db->prepare("SELECT id, event_id, payload AS body, UNIX_TIMESTAMP(updated_at) AS sent_epoch FROM facebook_jobs WHERE kind = 'reply' AND status = 'succeeded' AND event_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY updated_at, id');
                $replies->execute($ids);
                $byEvent = [];
                foreach ($replies->fetchAll() as $reply) {
                    $reply['type'] = 'text';
                    try { $deliveryPayload = json_decode((string) $reply['body'], true, 8, JSON_THROW_ON_ERROR); }
                    catch (JsonException) { $deliveryPayload = null; }
                    if (is_array($deliveryPayload) && ($deliveryPayload['__facebook_job_type'] ?? '') === 'room_photo') {
                        $photoId = (string) ($deliveryPayload['photo_id'] ?? '');
                        if (preg_match('/\A(?:room_[0-9]|[a-f0-9]{32}\.jpg)\z/', $photoId) === 1) {
                            $reply['type'] = 'image';
                            $reply['photo_url'] = '/api/stay-photo.php?id=' . rawurlencode($photoId);
                            $reply['body'] = 'Room photo';
                        }
                    } elseif (is_array($deliveryPayload) && ($deliveryPayload['__facebook_job_type'] ?? '') === 'room_photo_caption') {
                        $caption = $deliveryPayload['text'] ?? '';
                        $reply['body'] = is_string($caption) && trim($caption) !== '' ? trim($caption) : 'Room photos sent.';
                    } elseif (is_array($deliveryPayload) && ($deliveryPayload['__facebook_job_type'] ?? '') === 'staff_reply') {
                        $staffReply = $deliveryPayload['text'] ?? '';
                        $reply['body'] = is_string($staffReply) && trim($staffReply) !== '' ? trim($staffReply) : 'Staff reply';
                        $reply['origin'] = 'staff';
                    } elseif (is_array($deliveryPayload) && ($deliveryPayload['__facebook_job_type'] ?? '') === 'handoff_reply') {
                        $handoffReply = $deliveryPayload['text'] ?? '';
                        $reply['body'] = is_string($handoffReply) && trim($handoffReply) !== '' ? trim($handoffReply) : 'An admin will review your concern.';
                    }
                    $reply['sent_at'] = gmdate('Y-m-d\TH:i:s\Z', (int) $reply['sent_epoch']);
                    unset($reply['sent_epoch']);
                    $byEvent[$reply['event_id']][] = $reply;
                }
                foreach ($records as &$record) {
                    // The webhook writes gmdate() text; manual intake uses the DB clock.
                    // Preserve legacy storage and normalize only the inbox representation.
                    $record['message_at'] = $record['source'] === 'facebook'
                        ? str_replace(' ', 'T', $record['received_at']) . 'Z'
                        : gmdate('Y-m-d\TH:i:s\Z', (int) $record['received_epoch']);
                    $record['sent_replies'] = $byEvent[$record['id']] ?? [];
                }
                unset($record);
            }
            $count = $db->prepare('SELECT COUNT(*) FROM facebook_events e WHERE ' . $where); $count->execute($params); $total = (int) $count->fetchColumn();
        } elseif ($section !== 'rules') {
            $tables = ['drafts' => 'facebook_drafts', 'jobs' => 'facebook_jobs', 'audit' => 'facebook_audit'];
            $table = $tables[$section];
            $records = $db->query('SELECT * FROM ' . $table . ' ORDER BY id DESC LIMIT 25 OFFSET ' . $offset)->fetchAll();
            $total = (int) $db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
        }
        $counts = $db->query("SELECT SUM(kind = 'message' AND status <> 'resolved') AS inquiries, SUM(needs_attention = 1) AS alerts, SUM(kind = 'lead' AND booking_id IS NULL) AS leads FROM facebook_events")->fetch();
        $counts['drafts'] = (int) $db->query("SELECT COUNT(*) FROM facebook_drafts WHERE status = 'pending'")->fetchColumn();
        $configured = true;
        foreach (['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN', 'META_GRAPH_API_VERSION'] as $name) {
            if (getenv($name) === false || getenv($name) === '') { $configured = false; break; }
        }
        $verifiedAt = $db->query('SELECT verified_at FROM facebook_webhook_state WHERE id = 1')->fetchColumn();
        $connection = $configured && is_string($verifiedAt) ? 'connected' : 'not_connected';
        jsonResponse(['status' => 'success', 'connection' => $connection, 'webhook_verified_at' => $verifiedAt ?: null, 'settings' => $settings, 'counts' => $counts, 'records' => $records, 'total' => $total, 'page' => $page]);
    }

    $data = readJsonBody(65536);
    $action = facebookText($data, 'action', 40);
    $actor = (int) $admin['id'];
    $id = $data['id'] ?? null;
    $revision = $data['revision'] ?? null;
    $db->beginTransaction();
    if ($action === 'send_message') {
        if (!is_int($id) || $id < 1 || !is_int($revision)) throw new FacebookWorkflowError('Invalid conversation.');
        $body = facebookText($data, 'body', 2000);
        $query = $db->prepare('SELECT *, TIMESTAMPDIFF(SECOND, last_customer_message_at, CURRENT_TIMESTAMP) AS message_age_seconds FROM facebook_events WHERE id = ? FOR UPDATE');
        $query->execute([$id]);
        $event = $query->fetch();
        if (!$event || (int) $event['revision'] !== $revision) throw new FacebookWorkflowError('This conversation changed. Refresh and try again.', 409);
        $pageId = (string) getenv('META_PAGE_ID');
        if ($pageId === '' || $event['source'] !== 'facebook' || $event['kind'] !== 'message' || !is_string($event['sender_id']) || $event['sender_id'] === '' || !is_string($event['page_id']) || !hash_equals($pageId, $event['page_id'])) throw new FacebookWorkflowError('Only verified Facebook Page conversations can receive replies here.');
        $messageAge = filter_var($event['message_age_seconds'], FILTER_VALIDATE_INT);
        if ($messageAge === false || $messageAge < 0 || $messageAge > 86400) throw new FacebookWorkflowError('Facebook’s 24-hour reply window has ended for this conversation.');
        if ($event['status'] === 'resolved') throw new FacebookWorkflowError('Reopen this inquiry before replying.');
        $payload = json_encode(['__facebook_job_type' => 'staff_reply', 'text' => $body], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $db->prepare("UPDATE facebook_jobs SET status = 'cancelled', error_code = 'staff_reply_superseded' WHERE event_id = ? AND kind = 'reply' AND status IN ('blocked','pending','retry_wait')")->execute([$id]);
        $dedupeKey = 'staff-reply:event:' . $id . ':' . bin2hex(random_bytes(12));
        $insert = $db->prepare("INSERT INTO facebook_jobs (event_id, kind, dedupe_key, payload, status) VALUES (?, 'reply', ?, ?, 'pending')");
        $insert->execute([$id, $dedupeKey, $payload]);
        facebookAudit($db, $actor, 'staff_reply_queued', 'event', $id);
    } elseif ($action === 'save_rules') {
        $rules = $data['rules'] ?? null;
        if (!is_array($rules) || !is_int($revision) || $revision < 0) throw new FacebookWorkflowError('Invalid automation settings.');
        $validated = [];
        foreach (['categorize', 'prepare_replies', 'notify_comments'] as $flag) {
            if (!is_bool($rules[$flag] ?? null)) throw new FacebookWorkflowError('Invalid automation setting.');
            $validated[$flag] = $rules[$flag];
        }
        if (!is_array($rules['templates'] ?? null)) throw new FacebookWorkflowError('Reply templates are required.');
        foreach (facebookCategories() as $category) $validated['templates'][$category] = facebookText($rules['templates'], $category, 1000, false);
        if (!is_array($rules['guided_replies'] ?? null)) throw new FacebookWorkflowError('Guided booking replies are required.');
        foreach (facebookGuidedReplyKeys() as $key) $validated['guided_replies'][$key] = facebookText($rules['guided_replies'], $key, 1000);
        if (!str_contains($validated['guided_replies']['confirm_dates'], '{dates}')) throw new FacebookWorkflowError('The date confirmation reply must include {dates}.');
        if (!str_contains($validated['guided_replies']['pending_created'], '{reference}')) throw new FacebookWorkflowError('The pending booking reply must include {reference}.');
        if (!str_contains($validated['guided_replies']['pending_updated'], '{reference}')) throw new FacebookWorkflowError('The pending booking update reply must include {reference}.');
        if (!is_array($rules['keywords'] ?? null)) throw new FacebookWorkflowError('Category keywords are required.');
        foreach (facebookCategories() as $category) {
            $items = $rules['keywords'][$category] ?? null;
            if (!is_array($items) || count($items) > 40) throw new FacebookWorkflowError('Use no more than 40 keywords per category.');
            $validated['keywords'][$category] = [];
            foreach ($items as $item) {
                if (!is_string($item)) throw new FacebookWorkflowError('Category keywords must be text.');
                $item = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $item) ?? ''), 'UTF-8');
                if ($item === '') continue;
                if (mb_strlen($item) > 60 || preg_match('/[\x00-\x1F\x7F]/u', $item)) throw new FacebookWorkflowError('Each keyword must be 60 characters or fewer.');
                $validated['keywords'][$category][$item] = $item;
            }
            $validated['keywords'][$category] = array_values($validated['keywords'][$category]);
        }
        $json = json_encode($validated, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if ($revision === 0) {
            $db->prepare('INSERT INTO facebook_settings (id, rules_json) VALUES (1, ?)')->execute([$json]);
        } else {
            $query = $db->prepare('UPDATE facebook_settings SET rules_json = ?, revision = revision + 1 WHERE id = 1 AND revision = ?');
            $query->execute([$json, $revision]);
            if (!$query->rowCount()) throw new FacebookWorkflowError('Settings changed. Refresh before saving again.', 409);
        }
        facebookAudit($db, $actor, 'rules_saved', 'settings', 1);
    } elseif ($action === 'intake') {
        $kind = facebookText($data, 'kind', 20);
        if (!in_array($kind, ['message', 'comment', 'lead'], true)) throw new FacebookWorkflowError('Choose an inquiry, comment, or lead.');
        $name = facebookText($data, 'guest_name', 100);
        $body = facebookText($data, 'body', 4000);
        $email = facebookText($data, 'email', 190, false);
        $phone = facebookText($data, 'phone', 30, false);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new FacebookWorkflowError('Enter a valid email address.');
        if ($phone !== '' && !preg_match('/\A[0-9+()\-\s]{7,30}\z/', $phone)) throw new FacebookWorkflowError('Enter a valid phone number.');
        $external = facebookText($data, 'external_id', 190, false);
        if ($external !== '' && !preg_match('/\A[0-9_]+\z/', $external)) throw new FacebookWorkflowError('Facebook IDs may contain digits and underscores only.');
        $settings = facebookSettings($db)['rules'];
        $category = facebookCategory($body, $settings['categorize'], $settings['keywords'] ?? null);
        $alert = ($kind === 'comment' && $settings['notify_comments']) || $category === 'complaint';
        $db->prepare("INSERT INTO facebook_events (source, external_id, kind, guest_name, email, phone, body, category, needs_attention) VALUES ('manual', ?, ?, ?, ?, ?, ?, ?, ?)")->execute([$external ?: null, $kind, $name, strtolower($email), $phone, $body, $category, (int) $alert]);
        $eventId = (int) $db->lastInsertId();
        facebookAudit($db, $actor, 'manual_intake', 'event', $eventId);
        if ($alert) facebookAudit($db, $actor, 'staff_alert_created', 'event', $eventId);
        if ($settings['prepare_replies'] && facebookPrepareReply($db, ['id' => $eventId, 'kind' => $kind, 'category' => $category, 'status' => 'new'], $settings)) facebookAudit($db, $actor, 'reply_prepared', 'event', $eventId);
    } elseif (in_array($action, ['update_event', 'prepare_reply', 'publish_comment', 'hide_comment', 'clear_attention'], true)) {
        if (!is_int($id) || $id < 1 || !is_int($revision)) throw new FacebookWorkflowError('Invalid inquiry.');
        $query = $db->prepare('SELECT * FROM facebook_events WHERE id = ? FOR UPDATE'); $query->execute([$id]); $event = $query->fetch();
        if (!$event || (int) $event['revision'] !== $revision) throw new FacebookWorkflowError('This inquiry changed. Refresh and try again.', 409);
        if ($action === 'clear_attention') {
            $query = $db->prepare('UPDATE facebook_events SET needs_attention = 0, revision = revision + 1 WHERE id = ? AND revision = ?');
            $query->execute([$id, $revision]);
            if (!$query->rowCount()) throw new FacebookWorkflowError('This alert changed. Refresh and try again.', 409);
            facebookAudit($db, $actor, 'staff_alert_cleared', 'event', $id);
        } elseif (in_array($action, ['publish_comment', 'hide_comment'], true)) {
            if ($event['kind'] !== 'comment') throw new FacebookWorkflowError('Only comments can be shown on the website.');
            $publish = $action === 'publish_comment';
            $query = $db->prepare('UPDATE facebook_events SET website_status = ?, website_published_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?');
            $query->execute([$publish ? 'published' : 'hidden', $publish ? date('Y-m-d H:i:s') : null, $id, $revision]);
            if (!$query->rowCount()) throw new FacebookWorkflowError('This comment changed. Refresh and try again.', 409);
            facebookAudit($db, $actor, $publish ? 'comment_published' : 'comment_hidden', 'event', $id);
        } elseif ($action === 'prepare_reply') {
            if (!facebookPrepareReply($db, $event, facebookSettings($db)['rules'])) throw new FacebookWorkflowError('A reply is already prepared, no template is set, or this inquiry needs a person.', 409);
            facebookAudit($db, $actor, 'reply_prepared', 'event', $id);
        } else {
            $category = facebookText($data, 'category', 30);
            $status = facebookText($data, 'status', 30);
            $attention = $data['needs_attention'] ?? null;
            if (!in_array($category, facebookCategories(), true) || !in_array($status, ['new', 'in_progress', 'resolved'], true) || !is_bool($attention) || $event['booking_id']) throw new FacebookWorkflowError('Invalid inquiry update. Converted leads cannot be changed here.');
            $db->prepare('UPDATE facebook_events SET category = ?, status = ?, needs_attention = ?, revision = revision + 1 WHERE id = ?')->execute([$category, $status, (int) $attention, $id]);
            // Invalidate stale replies after a human changes category or resolves a conversation.
            if ($category !== $event['category'] || $status === 'resolved') $db->prepare("UPDATE facebook_jobs SET status = 'cancelled', error_code = 'inquiry_changed' WHERE event_id = ? AND status IN ('blocked','pending','retry_wait')")->execute([$id]);
            facebookAudit($db, $actor, 'inquiry_updated', 'event', $id);
        }
    } elseif (in_array($action, ['save_draft', 'generate_draft'], true)) {
        $title = facebookText($data, 'title', 120);
        $body = facebookText($data, 'body', $action === 'generate_draft' ? 3600 : 4000);
        if ($action === 'generate_draft') $body = "A little time by the sea at Odidepse Beach Resort.\n\n" . $body . "\n\nMessage our team to ask about dates and availability.";
        if ($id !== null) {
            if (!is_int($id) || $id < 1 || !is_int($revision)) throw new FacebookWorkflowError('Invalid draft.');
            $query = $db->prepare("UPDATE facebook_drafts SET title = ?, body = ?, status = 'pending', approved_by = NULL, approved_at = NULL, revision = revision + 1 WHERE id = ? AND revision = ? AND status <> 'published'");
            $query->execute([$title, $body, $id, $revision]);
            if (!$query->rowCount()) throw new FacebookWorkflowError('Draft changed. Refresh before editing again.', 409);
        } else {
            $db->prepare('INSERT INTO facebook_drafts (title, body) VALUES (?, ?)')->execute([$title, $body]);
            $id = (int) $db->lastInsertId();
        }
        facebookAudit($db, $actor, $action === 'generate_draft' ? 'draft_generated' : 'draft_saved', 'draft', $id);
    } elseif (in_array($action, ['approve_draft', 'reject_draft'], true)) {
        if (!is_int($id) || $id < 1 || !is_int($revision)) throw new FacebookWorkflowError('Invalid draft.');
        $approve = $action === 'approve_draft';
        $query = $db->prepare("UPDATE facebook_drafts SET status = ?, approved_by = ?, approved_at = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND status = 'pending'");
        $query->execute([$approve ? 'approved' : 'rejected', $approve ? $actor : null, $approve ? date('Y-m-d H:i:s') : null, $id, $revision]);
        if (!$query->rowCount()) throw new FacebookWorkflowError('Only the latest pending draft can be reviewed. Refresh and try again.', 409);
        facebookAudit($db, $actor, $action, 'draft', $id);
    } elseif ($action === 'cancel_job') {
        if (!is_int($id) || $id < 1) throw new FacebookWorkflowError('Invalid job.');
        $query = $db->prepare("UPDATE facebook_jobs SET status = 'cancelled' WHERE id = ? AND status IN ('blocked','pending','retry_wait')");
        $query->execute([$id]);
        if (!$query->rowCount()) throw new FacebookWorkflowError('This job cannot be cancelled.', 409);
        facebookAudit($db, $actor, 'job_cancelled', 'job', $id);
    } else {
        throw new FacebookWorkflowError('Unsupported automation action.');
    }
    $db->commit();
    jsonResponse(['status' => 'success', 'message' => 'Changes saved.']);
} catch (FacebookWorkflowError $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonResponse(['status' => 'error', 'message' => $error->getMessage()], $error->getCode() === 409 ? 409 : 422);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? 0) === 1062) jsonResponse(['status' => 'error', 'message' => 'This Facebook item was already imported, or these settings changed. Refresh before continuing.'], 409);
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? 0) === 1146) jsonResponse(['status' => 'error', 'message' => 'Facebook Automations database setup is pending. Apply migration 004 to enable this workspace.'], 503);
    error_log('Facebook workflow failed: ' . get_class($error));
    jsonResponse(['status' => 'error', 'message' => 'Facebook Automations is temporarily unavailable. Please try again.'], 500);
}
