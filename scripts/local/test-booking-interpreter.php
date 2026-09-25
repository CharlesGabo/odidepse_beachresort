<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/automations/website-chat.php';
function interpreterCheck(bool $condition, string $label): void { if (!$condition) throw new RuntimeException($label); }
try {
    $db = database();
    $rules = facebookDefaultRules();
    $provider = static fn($payload) => ['intent' => 'booking', 'fields' => [['field' => 'guests', 'value' => '6', 'evidence' => 'half a dozen']], 'ambiguous' => []];
    $body = 'We are half a dozen';
    $parsed = bookingInterpret($db, $body, 'booking', [], 'booking', $provider);
    interpreterCheck(($parsed['fields']['guests'] ?? null) === 6, 'Natural guest count extracted');
    $faqBody = 'nagsa-sakay po kayo ng jetski dyan';
    $faqProvider = static fn($payload) => ['intent' => 'faq', 'fields' => [], 'ambiguous' => []];
    $faqParsed = bookingInterpret($db, $faqBody, 'booking', ['guests' => 6], 'amenities', $faqProvider);
    interpreterCheck(($faqParsed['intent'] ?? '') === 'faq' && $faqParsed['fields'] === [] && $faqParsed['ambiguous'] === [], 'AI recognizes informal Tagalog FAQ during a booking');
    interpreterCheck(bookingInterpreterValidate($faqProvider([]), '5 guests', facebookConversationDetails('5 guests'), [], ['stays' => [], 'services' => []]) === null, 'Explicit booking details cannot be overridden as FAQ');
    $timesOnly = 'Check in 2 PM, check out 11 AM';
    $spuriousGuests = bookingInterpreterValidate(['intent' => 'booking', 'fields' => [], 'ambiguous' => ['guests']],
        $timesOnly, facebookConversationDetails($timesOnly), ['check_in' => '2027-10-10', 'check_out' => '2027-10-12'], ['stays' => [], 'services' => []]);
    interpreterCheck($spuriousGuests['ambiguous'] === [], 'Missing guests are not mistaken for ambiguous guests');
    $chat = ['state' => 'booking', 'data' => [], 'csrf' => 'test'];
    websiteChatReply($db, $chat, $body, $rules, null, $provider);
    interpreterCheck(($chat['data']['guests'] ?? null) === 6, 'Website applies candidate');
    $firstUnclear = static fn($payload) => ['intent' => 'booking', 'fields' => [['field' => 'guests', 'value' => '6', 'evidence' => 'half a dozen']], 'ambiguous' => ['check_in', 'check_out', 'stay']];
    $followup = 'Check in: October 10, 2027. Check out: October 12, 2027. Arrive: 2 PM. Leave: 11 AM.';
    interpreterCheck(facebookConversationDates($followup) === ['2027-10-10', '2027-10-12'], 'Two labelled dates beat single-date shortcut');
    $websiteSequence = ['state' => 'idle', 'data' => [], 'csrf' => 'sequence'];
    websiteChatReply($db, $websiteSequence, 'We are half a dozen and want a room in two weeks', $rules, null, $firstUnclear);
    interpreterCheck(($websiteSequence['data']['guests'] ?? null) === 6 && $websiteSequence['state'] === 'booking', 'Website retains valid guests while asking for dates');
    $secondUnclear = static fn($payload) => ['intent' => 'booking', 'fields' => [], 'ambiguous' => ['check_out']];
    $sequenceReply = websiteChatReply($db, $websiteSequence, $followup, $rules, null, $secondUnclear);
    interpreterCheck(($websiteSequence['data']['check_in'] ?? '') === '2027-10-10' && ($websiteSequence['data']['check_out'] ?? '') === '2027-10-12' && ($websiteSequence['data']['guests'] ?? null) === 6, 'Website retains guests and accepts labelled dates');
    interpreterCheck(!str_contains($sequenceReply['reply'], 'Please clarify your check-out date'), 'Website does not repeat resolved ambiguity');
    $conflict = bookingInterpret($db, $body, 'booking', ['guests' => 5], 'booking', $provider);
    interpreterCheck(in_array('guests', $conflict['ambiguous'], true), 'Existing data conflict');
    $ambiguous = static fn($payload) => ['intent' => 'booking', 'fields' => [], 'ambiguous' => ['check_in_time']];
    $reply = websiteChatReply($db, $chat, 'arriving around lunchtime', $rules, null, $ambiguous);
    interpreterCheck(str_contains($reply['reply'], 'AM or PM'), 'Targeted clarification');
    interpreterCheck(str_contains(websiteChatReply($db, $chat, 'CONFIRM', $rules)['reply'], 'clarify'), 'Cannot confirm ambiguity');
    websiteChatReply($db, $chat, 'hello', $rules, null, $provider);
    interpreterCheck(!empty($chat['data']['interpretation_pending']), 'Unrelated reply cannot clear ambiguity');
    websiteChatReply($db, $chat, 'Check in: 2 PM', $rules, null, static fn() => null);
    interpreterCheck(empty($chat['data']['interpretation_pending']) && $chat['data']['check_in_time'] === '14:00', 'Explicit clarification resolves pending field');
    $safe = bookingInterpreterSanitize("Name: Maria Santos, maria@example.test, 09171234567\nNotes: private medical request\nOD-ABC123", ['facebook_profile_name' => 'Maria Santos']);
    foreach (['Maria', 'example.test', '0917', 'medical', 'ABC123'] as $secret) interpreterCheck(!str_contains($safe, $secret), 'Privacy filter ' . $secret);
    $calls = 0;
    $spy = static function ($payload) use (&$calls) { $calls++; return null; };
    foreach (['CONFIRM', 'RESTART', 'CANCEL', 'ADMIN', 'hello'] as $command) bookingInterpret($db, $command, 'booking', [], 'general', $spy);
    interpreterCheck($calls === 0, 'Control messages bypass provider');
    $local = facebookConversationDetails($body);
    $catalog = ['stays' => ['Room A'], 'services' => ['Jet ski']];
    interpreterCheck(bookingInterpreterValidate(['intent' => 'booking', 'fields' => [], 'ambiguous' => [], 'sql' => 'bad'], $body, $local, [], $catalog) === null, 'Unknown properties rejected');
    interpreterCheck(bookingInterpreterValidate(['intent' => 'booking', 'fields' => [['field' => 'guests', 'value' => '999', 'evidence' => 'half a dozen']], 'ambiguous' => []], $body, $local, [], $catalog) === null, 'Guest range enforced');
    interpreterCheck(bookingInterpret($db, $body, 'booking', [], 'booking', static fn() => null)['status'] === 'fallback', 'Provider failure fallback');
    $invalidEvidence = ['intent' => 'booking', 'fields' => [['field' => 'guests', 'value' => '6', 'evidence' => 'invented evidence']], 'ambiguous' => []];
    interpreterCheck(bookingInterpreterValidate($invalidEvidence, $body, $local, [], $catalog) === null, 'Invented evidence rejected');
    $badCatalog = ['intent' => 'booking', 'fields' => [['field' => 'stay', 'value' => 'Invented palace', 'evidence' => 'half a dozen']], 'ambiguous' => []];
    interpreterCheck(bookingInterpreterValidate($badCatalog, $body, $local, [], $catalog) === null, 'Invented accommodation rejected');
    $localConflict = bookingInterpreterValidate($provider([]), $body, array_replace($local, ['guests' => 5]), [], $catalog);
    interpreterCheck(in_array('guests', $localConflict['ambiguous'], true) && empty($localConflict['fields']), 'Deterministic conflict asks clarification');
    $db->beginTransaction();
    $sender = 'interpreter-test-' . bin2hex(random_bytes(5));
    $db->prepare("INSERT INTO facebook_events (source,page_id,sender_id,kind,guest_name,body,category,last_customer_message_at) VALUES ('facebook','test-page',?,'message','Messenger guest',?,'booking',CURRENT_TIMESTAMP)")->execute([$sender, $body]);
    $event = ['id' => (int) $db->lastInsertId(), 'page_id' => 'test-page', 'sender_id' => $sender, 'body' => $body, 'category' => 'booking'];
    facebookConversationReply($db, $event, $rules, $parsed);
    $q = $db->prepare('SELECT data_json FROM facebook_conversations WHERE page_id = ? AND sender_id = ?'); $q->execute(['test-page', $sender]);
    interpreterCheck((json_decode($q->fetchColumn(), true)['guests'] ?? null) === 6, 'Messenger applies same candidate');
    $db->rollBack();
    echo "Passed interpreter validation, privacy, website/Messenger parity, ambiguity, and fallback tests. No provider calls.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Interpreter test failed: ' . $error->getMessage() . PHP_EOL); exit(1);
}
