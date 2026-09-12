<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/includes/facebook-automations.php';
function checkFacebook(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
try {
    checkFacebook(facebookCategory('Magkano po ang room?') === 'rates', 'Filipino rates classification');
    checkFacebook(facebookCategory('Pwede po ba magpareserve?', true, facebookDefaultRules()['keywords']) === 'booking', 'Editable Tagalog booking classification');
    checkFacebook(facebookCategory('Malapit ba kayo sa bayan?', true, facebookDefaultRules()['keywords']) === 'location', 'Editable Tagalog location classification');
    checkFacebook(facebookCategory('This is a separate question') === 'general', 'Keyword boundaries avoid partial-word matches');
    checkFacebook(facebookCategory('Booking complaint: refund please') === 'complaint', 'Complaint priority');
    checkFacebook(facebookCategory('Is there availability?', false) === 'general', 'Disabled classification');
    checkFacebook(facebookProfileName(['name' => '  Maria   Santos  ']) === 'Maria Santos', 'Messenger profile name normalization');
    checkFacebook(facebookProfileName(['name' => '']) === null, 'Empty Messenger profile name fallback');
    checkFacebook(facebookRetryDecision(1, 429, false, false, 300)['delay'] === 300, 'Retry-After honored');
    checkFacebook(facebookRetryDecision(2, 503, false)['delay'] === 120, 'Exponential backoff');
    checkFacebook(facebookRetryDecision(5, 503, true)['status'] === 'failed', 'Retry limit');
    checkFacebook(facebookRetryDecision(1, 403, false)['status'] === 'failed', 'Permission errors not retried');
    checkFacebook(facebookRetryDecision(1, 503, true, true)['status'] === 'failed', 'Unconfirmed delivery not duplicated');
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1', 'localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local database required.');
    $db = database();
    $db->beginTransaction();
    $db->exec("INSERT INTO facebook_events (source,kind,guest_name,body,category) VALUES ('manual','message','Automation verification','Is a room available?','booking')");
    $id = (int) $db->lastInsertId();
    $event = ['id' => $id, 'kind' => 'message', 'category' => 'booking', 'status' => 'new'];
    checkFacebook(facebookPrepareReply($db, $event, facebookDefaultRules()), 'Reply preparation');
    checkFacebook(!facebookPrepareReply($db, $event, facebookDefaultRules()), 'Duplicate reply suppressed');
    $query = $db->prepare('SELECT status FROM facebook_jobs WHERE event_id = ?'); $query->execute([$id]);
    checkFacebook($query->fetchColumn() === 'blocked', 'Disconnected reply remains blocked');
    $db->exec("INSERT INTO facebook_events (source,page_id,sender_id,kind,guest_name,body,last_customer_message_at,category) VALUES ('facebook','123','456','message','Webhook verification','How much? ',CURRENT_TIMESTAMP,'rates')");
    $webhookId = (int) $db->lastInsertId();
    checkFacebook(facebookPrepareReply($db, ['id' => $webhookId, 'kind' => 'message', 'category' => 'rates', 'status' => 'new'], facebookDefaultRules(), true), 'Automatic reply queueing');
    $query = $db->prepare('SELECT status FROM facebook_jobs WHERE event_id = ?'); $query->execute([$webhookId]);
    checkFacebook($query->fetchColumn() === 'pending', 'Verified webhook reply is ready for delivery');
    $db->exec("INSERT INTO facebook_events (source,kind,guest_name,body,category,needs_attention) VALUES ('manual','message','Complaint verification','I have a complaint','complaint',1)");
    $complaintId = (int) $db->lastInsertId();
    checkFacebook(facebookPrepareReply($db, ['id' => $complaintId, 'kind' => 'message', 'category' => 'complaint', 'status' => 'new'], facebookDefaultRules()), 'Complaint acknowledgement');
    $query = $db->prepare('SELECT payload FROM facebook_jobs WHERE event_id = ?'); $query->execute([$complaintId]);
    checkFacebook(str_contains((string) $query->fetchColumn(), 'admin'), 'Complaint acknowledgement directs to admin');
    facebookAudit($db, null, 'verification', 'event', $id);
    $query = $db->prepare('SELECT COUNT(*) FROM facebook_audit WHERE entity_id = ? AND action = ?'); $query->execute([$id, 'verification']);
    checkFacebook((int) $query->fetchColumn() === 1, 'Audit persistence');
    $db->rollBack();
    echo "Passed: classification, profile names, reply deduplication, complaint acknowledgement, automatic queueing, blocked manual delivery, retry policy, audit persistence. Test rows rolled back.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Facebook verification failed: ' . ($error instanceof PDOException ? 'Database operation failed.' : $error->getMessage()) . "\n");
    exit(1);
}
