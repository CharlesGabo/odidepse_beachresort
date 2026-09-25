<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/automations/facebook-worker.php';
$db = database();
$sender = 'worker-check-' . bin2hex(random_bytes(6));
$eventId = null;
try {
    if (!facebookConversationJobsAvailable($db)) throw new RuntimeException('Migration 015 is required.');
    $beforeBookings = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $db->prepare("INSERT INTO facebook_events (source,page_id,sender_id,kind,guest_name,body,category,last_customer_message_at) VALUES ('facebook','worker-test',?,'message','Messenger guest','Booking','booking',CURRENT_TIMESTAMP)")->execute([$sender]);
    $eventId = (int) $db->lastInsertId();
    $db->prepare("INSERT INTO facebook_jobs (event_id,kind,dedupe_key,payload,status,attempts) VALUES (?,'conversation',?,'','processing',1)")
        ->execute([$eventId, 'conversation:event:' . $eventId]);
    $jobId = (int) $db->lastInsertId();
    workerProcessConversation($db, ['id' => $jobId, 'event_id' => $eventId, 'page_id' => 'worker-test', 'sender_id' => $sender,
        'body' => 'Booking', 'category' => 'booking', 'attempts' => 1]);
    $query = $db->prepare('SELECT status FROM facebook_jobs WHERE id = ?'); $query->execute([$jobId]);
    if ($query->fetchColumn() !== 'succeeded') throw new RuntimeException('Conversation job did not complete.');
    $query = $db->prepare("SELECT COUNT(*) FROM facebook_jobs WHERE event_id = ? AND kind = 'reply' AND status = 'pending'"); $query->execute([$eventId]);
    if ((int) $query->fetchColumn() !== 1) throw new RuntimeException('Exactly one reply was not queued.');
    $query = $db->prepare('SELECT state FROM facebook_conversations WHERE page_id = ? AND sender_id = ?'); $query->execute(['worker-test', $sender]);
    if ($query->fetchColumn() !== 'awaiting_booking_details') throw new RuntimeException('Conversation state not saved.');
    if ((int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn() !== $beforeBookings) throw new RuntimeException('Booking count changed.');
    echo "Passed queued Messenger conversation processing. No Meta send or provider call.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Worker test failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
} finally {
    if ($eventId !== null) {
        $db->prepare('DELETE FROM facebook_jobs WHERE event_id = ?')->execute([$eventId]);
        $db->prepare('DELETE FROM facebook_audit WHERE entity_type = ? AND entity_id = ?')->execute(['event', $eventId]);
        $db->prepare('DELETE FROM facebook_conversations WHERE page_id = ? AND sender_id = ?')->execute(['worker-test', $sender]);
        $db->prepare('DELETE FROM facebook_events WHERE id = ?')->execute([$eventId]);
    }
}
