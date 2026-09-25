<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/automations/website-chat.php';
function chatCheck(bool $condition, string $label): void { if (!$condition) throw new RuntimeException($label); }
try {
    $db = database(); $db->beginTransaction();
    $before = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $rules = facebookSettings($db)['rules'];
    $chat = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'test'];
    $rules['templates']['location'] = 'Shared location test';
    chatCheck(websiteChatReply($db, $chat, 'Location', $rules)['reply'] === 'Shared location test', 'Shared category template');
    $rules['templates']['general'] = 'Shared fallback';
    chatCheck(websiteChatReply($db, $chat, 'Hello', $rules, static fn() => null)['reply'] === 'Shared fallback', 'AI failure fallback');
    chatCheck(websiteChatReply($db, $chat, 'Hello', $rules, static fn() => 'Hello po')['source'] === 'ai', 'AI routing');
    $faqChat = ['state' => 'booking', 'data' => ['guests' => 6, 'interpretation_pending' => ['check_out']], 'history' => [], 'csrf' => 'faq'];
    $faqBefore = $faqChat;
    $faqResult = websiteChatReply($db, $faqChat, 'do you have jet skis as well', $rules,
        static fn() => 'Jet ski rental is available upon inquiry.',
        static function (): never { throw new RuntimeException('FAQ reached booking interpreter'); });
    chatCheck($faqResult['source'] === 'ai' && str_contains($faqResult['reply'], 'Jet ski rental') && $faqChat === $faqBefore, 'Website AI answers activity question without changing pending booking');
    $faqFallback = websiteChatReply($db, $faqChat, 'do you have jet skis as well', $rules, static fn() => null);
    chatCheck($faqFallback['source'] === 'fallback' && str_contains($faqFallback['reply'], 'jet ski') && $faqChat === $faqBefore, 'Website activity FAQ fallback keeps pending booking');
    $generalFaq = websiteChatReply($db, $faqChat, 'What time is check-in?', $rules, static fn() => 'Staff can advise the check-in time.');
    chatCheck($generalFaq['source'] === 'ai' && $faqChat === $faqBefore, 'General support question uses AI during booking');
    $tagalogFaq = websiteChatReply($db, $faqChat, 'nagsa-sakay po kayo ng jetski dyan', $rules,
        static fn() => 'May jet ski rental po, subject to staff confirmation. Gusto ninyong isama sa stay inquiry?',
        static fn() => ['intent' => 'faq', 'fields' => [], 'ambiguous' => []]);
    chatCheck($tagalogFaq['source'] === 'ai' && str_contains($tagalogFaq['reply'], 'jet ski') && $faqChat === $faqBefore, 'Unusual Tagalog amenity inquiry is routed by AI without changing booking');
    $tagalogFallback = websiteChatReply($db, $faqChat, 'nagsa-sakay po kayo ng jetski dyan', $rules,
        static fn() => null, static fn() => ['intent' => 'faq', 'fields' => [], 'ambiguous' => []]);
    chatCheck($tagalogFallback['source'] === 'fallback' && $faqChat === $faqBefore, 'AI support failure keeps booking draft intact');
    chatCheck(!facebookConversationInformationQuestion('Can I add jet ski to my booking?'), 'Activity booking requests are not treated as FAQ');
    $continuedChat = ['state' => 'booking', 'data' => ['check_in' => '2027-10-10', 'check_out' => '2027-10-12'], 'history' => [], 'csrf' => 'continued'];
    $continuedReply = websiteChatReply($db, $continuedChat, 'Check in 2 PM, check out 11 AM', $rules, null,
        static fn() => ['intent' => 'booking', 'fields' => [], 'ambiguous' => ['guests']]);
    chatCheck(($continuedChat['data']['check_in_time'] ?? '') === '14:00' && ($continuedChat['data']['check_out_time'] ?? '') === '11:00'
        && !isset($continuedChat['data']['interpretation_pending']) && str_contains($continuedReply['reply'], 'Total pax: NOT PROVIDED YET')
        && !str_contains($continuedReply['reply'], 'Please clarify your total number of guests'), 'Time follow-up keeps dates and asks normally for missing guests');
    $friendlyStart = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'friendly'];
    $friendlyReply = websiteChatReply($db, $friendlyStart, 'Booking', $rules)['reply'];
    chatCheck(str_contains($friendlyReply, facebookGuidedReply($rules, 'start')) && str_contains($friendlyReply, facebookGuidedReply($rules, 'ask_booking_details')) && !str_contains($friendlyReply, 'Name: Needed'), 'Website booking start uses friendly shared instructions');
    $guestStart = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'guest-start'];
    websiteChatReply($db, $guestStart, '5 guests', $rules);
    chatCheck($guestStart['state'] === 'booking' && ($guestStart['data']['guests'] ?? null) === 5, 'Guest count alone starts website booking flow');
    $inquiryStart = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'inquiry-start'];
    websiteChatReply($db, $inquiryStart, "I'd like to inqure", $rules);
    chatCheck($inquiryStart['state'] === 'booking' && empty($inquiryStart['data']['guest_name']), 'Common inquiry wording starts website booking flow without becoming the guest name');
    foreach (['hm', 'how much po', 'magkano po'] as $rateQuestion) {
        $rateStart = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'rate-start'];
        websiteChatReply($db, $rateStart, $rateQuestion, $rules);
        chatCheck($rateStart['state'] === 'rates', $rateQuestion . ' starts the website rate flow');
    }
    $sameDayStart = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    $sameDayChat = ['state' => 'booking', 'data' => [], 'history' => [], 'csrf' => 'same-day'];
    websiteChatReply($db, $sameDayChat, $sameDayStart->format('Y-m-d') . ' to ' . $sameDayStart->modify('+1 day')->format('Y-m-d'), $rules);
    chatCheck(($sameDayChat['data']['check_in'] ?? '') === $sameDayStart->format('Y-m-d'), 'Website chat accepts a booking request beginning today');
    $overlapStart = $sameDayStart->modify('+520 days');
    $overlapEnd = $overlapStart->modify('+1 day');
    $bestFit = null;
    foreach ($db->query("SELECT id,name,details FROM resort_stays WHERE enabled=1 AND archived=0 AND availability <> 'unavailable' ORDER BY sort_order,id")->fetchAll() as $stayRow) {
        $stayDetails = json_decode($stayRow['details'], true, 32, JSON_THROW_ON_ERROR);
        if (5 < (int) ($stayDetails['min_guests'] ?? 1) || 5 > (int) ($stayDetails['max_guests'] ?? 0) || ($stayDetails['style'] ?? 'standard') !== 'standard') continue;
        $candidate = $stayRow + ['max_guests' => (int) $stayDetails['max_guests'], 'room_count' => (int) ($stayDetails['room_count'] ?? 1)];
        if ($bestFit === null || [$candidate['max_guests'], $candidate['id']] < [$bestFit['max_guests'], $bestFit['id']]) $bestFit = $candidate;
    }
    chatCheck($bestFit !== null, 'A best-fit room exists for website overlap guidance');
    $blockBestFit = $db->prepare("INSERT INTO bookings (reference_code,guest_name,email,phone,check_in,check_out,guests,stay_type,stay_id,message,status) VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed')");
    $overlapBlockerIds = [];
    for ($room = 1; $room <= max(1, $bestFit['room_count']); $room++) {
        $blockBestFit->execute(['WEB-OVERLAP-' . bin2hex(random_bytes(4)), 'Overlap verification', 'verify@example.test', '', $overlapStart->format('Y-m-d'), $overlapEnd->format('Y-m-d'), 5, $bestFit['name'], $bestFit['id'], 'Website overlap guidance test']);
        $overlapBlockerIds[] = (int) $db->lastInsertId();
    }
    $overlapChat = ['state' => 'booking', 'data' => [], 'history' => [], 'csrf' => 'overlap'];
    $overlapReply = websiteChatReply($db, $overlapChat, "Dates: {$overlapStart->format('Y-m-d')} to {$overlapEnd->format('Y-m-d')}\nCheck in: 2 PM\nCheck out: 11 AM\nGuests: 5\nName: Maria Santos\nEmail: maria@example.test\nPhone: 09171234567", $rules)['reply'];
    chatCheck(str_contains($overlapReply, 'no longer available') && str_contains($overlapReply, 'overlap with a confirmed booking') && !empty($overlapChat['data']['availability_alternatives']), 'Website explains a best-fit room overlap before suggesting alternatives');
    $availabilityData = $overlapChat['data'];
    chatCheck(count($availabilityData['availability_alternatives']) >= 3, 'Website overlap fixture provides a third numbered alternative');
    $thirdAlternative = $availabilityData['availability_alternatives'][2];
    $thirdChoiceResult = websiteChatReply($db, $overlapChat, '3', $rules);
    chatCheck($overlapChat['state'] === 'review' && ($overlapChat['data']['stay_name'] ?? '') === $thirdAlternative['name'] && !str_contains($thirdChoiceResult['reply'], facebookGuidedReply($rules, 'ask_booking_details')), 'Website and Messenger share numbered alternative selection behavior');
    chatCheck(($thirdChoiceResult['photos'] ?? []) !== [] && ($thirdChoiceResult['photos'] ?? []) === array_slice($thirdAlternative['photos'] ?? [], 0, 3), 'Website review returns the selected room photos');
    websiteChatRecord($overlapChat, 'assistant', $thirdChoiceResult['reply'], $thirdChoiceResult['photos'] ?? [], $thirdChoiceResult['photoName'] ?? '');
    chatCheck(($overlapChat['history'][0]['photos'] ?? []) === ($thirdChoiceResult['photos'] ?? []), 'Website chat history retains selected room photos');
    $customDateChoice = facebookConversationResolveAvailabilityChoice($availabilityData, '1');
    chatCheck($customDateChoice['status'] === 'custom_dates' && empty($availabilityData['availability_alternatives']), 'Shared availability resolver accepts the custom-date option');
    $deleteOverlapBlocker = $db->prepare('DELETE FROM bookings WHERE id = ?');
    foreach ($overlapBlockerIds as $overlapBlockerId) $deleteOverlapBlocker->execute([$overlapBlockerId]);
    $start = (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->modify('+500 days');
    $end = $start->modify('+2 days');
    $combinationChat = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'combination'];
    websiteChatReply($db, $combinationChat, "Dates: {$start->format('F j')} to {$end->format('F j, Y')}\nCheck in: 2 PM\nCheck out: 11 AM\nGuests: 15\nName: Maria Santos\nEmail: maria@example.test\nPhone: 09171234567", $rules);
    chatCheck(($combinationChat['data']['stay_plan'][0]['quantity'] ?? 0) === 1 && count($combinationChat['data']['stay_plan'] ?? []) === 2, 'Website chat selects an available multi-room plan for fifteen guests');
    chatCheck(str_contains((string) ($combinationChat['data']['rate_breakdown'] ?? ''), "Room prices:\n• 1 × 10-guest room: PHP ") && str_contains((string) $combinationChat['data']['rate_breakdown'], 'Combined room rate: PHP ') && str_contains((string) $combinationChat['data']['rate_breakdown'], 'Estimated stay total (2 nights): PHP '), 'Website review retains the guest-friendly room and full-stay price breakdown');
    $combinationDraft = websiteChatReply($db, $combinationChat, 'CONFIRM', $rules)['draft'] ?? [];
    chatCheck(count($combinationDraft['stayPlan'] ?? []) === 2 && ($combinationDraft['stayId'] ?? null) === null, 'Website modal draft carries the exact multi-room plan');
    $labelledChat = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'labelled'];
    $labelledReply = websiteChatReply($db, $labelledChat, "Dates: {$start->format('F j')} to {$end->format('F j, Y')}\nCheck in: 2 PM\nCheck out: 11 AM\nGuests: 5\nName: Maria Santos\nEmail: maria@example.test\nPhone: 09171234567", $rules)['reply'];
    chatCheck(($labelledChat['data']['guests'] ?? null) === 5 && $labelledChat['state'] === 'review' && str_contains($labelledReply, '5 guests'), 'Label-first guest count completes website booking from idle');
    $yearBeforeGuestsChat = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'year-before-guests'];
    websiteChatReply($db, $yearBeforeGuestsChat, "Dates: October 10 to October 12, 2027\nGuests: 5\n11am checkin", $rules);
    chatCheck(($yearBeforeGuestsChat['data']['guests'] ?? null) === 5, 'Website never reads the date year as the following guest count');
    $sameMessage = "8 pax\n" . $start->format('Y-m-d') . ' to ' . $end->format('Y-m-d') . "\n2 PM\n11 AM\n09171234567 maria@example.test";
    $sharedDetails = facebookConversationDetails($sameMessage);
    chatCheck($sharedDetails['email'] === 'maria@example.test' && $sharedDetails['phone'] === '09171234567', 'Shared parser captures both contacts');
    $comparisonChat = ['state' => 'idle', 'data' => [], 'history' => [], 'csrf' => 'comparison'];
    $comparisonReply = websiteChatReply($db, $comparisonChat, $sameMessage, $rules)['reply'];
    chatCheck(str_contains($comparisonReply, 'Name: Needed') && str_contains($comparisonReply, 'Email: maria@example.test') && str_contains($comparisonReply, 'Mobile: +639171234567'), 'Website reports only unavailable channel identity');
    chatCheck(!str_contains($comparisonReply, facebookGuidedReply($rules, 'ask_booking_details')), 'Partial reply uses shared checklist without repeating instructions');
    $nameReply = websiteChatReply($db, $comparisonChat, 'Charles Martinez', $rules)['reply'];
    chatCheck($comparisonChat['state'] === 'review' && ($comparisonChat['data']['guest_name'] ?? '') === 'Charles Martinez', 'Standalone name completes website draft');
    chatCheck(str_contains($nameReply, 'Charles Martinez'), 'Accepted standalone name appears in review');
    $naturalChat = ['state' => 'booking', 'data' => [], 'history' => [], 'csrf' => 'natural'];
    $naturalReply = websiteChatReply($db, $naturalChat, 'check out time is 3pm, book it under the name Kate Beltrano, b.k.y.a@gmail.com, 0912345678', $rules)['reply'];
    chatCheck(($naturalChat['data']['check_out_time'] ?? '') === '15:00' && ($naturalChat['data']['guest_name'] ?? '') === 'Kate Beltrano' && ($naturalChat['data']['email'] ?? '') === 'b.k.y.a@gmail.com', 'Natural combined booking details are retained');
    chatCheck(!empty($naturalChat['data']['phone_invalid']) && str_contains($naturalReply, '11-digit number'), 'Invalid Philippine mobile number is explained');
    websiteChatReply($db, $naturalChat, '11am checkin', $rules);
    chatCheck(($naturalChat['data']['check_in_time'] ?? '') === '11:00', 'Website accepts time before check-in label');
    websiteChatReply($db, $chat, 'Rates', $rules);
    chatCheck($chat['state'] === 'rates', 'Partial rate state');
    websiteChatReply($db, $chat, $start->format('Y-m-d') . ' to ' . $end->format('Y-m-d') . ', 5 guests', $rules);
    chatCheck($chat['state'] === 'rates' && !empty($chat['data']['options']), 'Rate options');
    $offeredRooms = $chat['data']['options'];
    chatCheck(count($offeredRooms) >= 4, 'Four numbered room options are available for selection regression');
    $partyChangeChat = $chat;
    websiteChatReply($db, $partyChangeChat, '4 guests', $rules);
    chatCheck(($partyChangeChat['data']['guests'] ?? null) === 4, 'Explicit four-guest update remains a guest-count change');
    $chosenRoom = websiteChatReply($db, $chat, '4', $rules);
    chatCheck(($chat['data']['guests'] ?? null) === 5 && ($chat['data']['stay_id'] ?? null) === $offeredRooms[3]['id']
        && $chat['state'] === 'booking' && str_contains($chosenRoom['reply'], 'Room: ' . $offeredRooms[3]['name'])
        && !str_contains($chosenRoom['reply'], 'Suitable options for your group'), 'Fourth option is selected without changing five guests or repeating options');
    $answer = websiteChatReply($db, $chat, 'Booking', $rules);
    chatCheck(!str_contains($answer['reply'], 'For the website booking form'), 'Website omits redundant channel wording');
    $services = resortEntities($db, 'services', false);
    $service = $services[0] ?? null;
    chatCheck($service !== null, 'An enabled activity exists for chat testing');
    $answer = websiteChatReply($db, $chat, "Name: Maria Santos, email: maria@example.test, phone: 09171234567, check in 2:15pm check out 11:30am\nActivities: {$service['name']}\nNotes: Birthday stay", $rules);
    chatCheck($chat['state'] === 'review', 'Complete booking review: ' . json_encode($chat['data']));
    chatCheck(str_contains($answer['reply'], $service['name']) && str_contains($answer['reply'], 'Birthday stay'), 'Website summary includes shared activities and notes');
    $answer = websiteChatReply($db, $chat, 'CONFIRM', $rules);
    chatCheck(($answer['action'] ?? '') === 'open_booking' && $answer['draft']['email'] === 'maria@example.test' && $answer['draft']['phone'] === '+639171234567', 'Complete modal draft');
    chatCheck($answer['draft']['arrivalTime'] === '14:15' && $answer['draft']['departureTime'] === '11:30', 'Exact time prefill');
    chatCheck($answer['draft']['activityIds'] === [(int) $service['id']] && $answer['draft']['message'] === 'Birthday stay', 'Shared optional details prefill the modal');
    $again = websiteChatReply($db, $chat, 'CONFIRM', $rules);
    chatCheck($again['draft']['token'] === $answer['draft']['token'], 'Repeated confirmation reuses draft');
    chatCheck(websiteChatDraftValid($chat, $answer['draft']['token']), 'Valid session-bound draft');
    chatCheck(!websiteChatDraftValid($chat, 'different'), 'Wrong draft token');
    $expired = $chat; $expired['draft']['expires'] = time() - 1;
    chatCheck(!websiteChatDraftValid($expired, $answer['draft']['token']), 'Expired draft token');
    $used = $chat; unset($used['draft']);
    chatCheck(!websiteChatDraftValid($used, $answer['draft']['token']), 'Consumed draft token');
    chatCheck((int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn() === $before, 'Chat confirmation never inserts booking');
    websiteChatReply($db, $chat, 'ADMIN', $rules);
    chatCheck($chat['state'] === 'handoff' && !isset($chat['draft']), 'Staff handoff invalidates draft');
    $redacted = websiteChatRedact('maria@example.test +63 917 123 4567 OD-W-ABC123');
    chatCheck(!str_contains($redacted, 'example.test') && !str_contains($redacted, '917') && !str_contains($redacted, 'ABC123'), 'PII redaction');
    $payload = websiteChatGeminiPayload(resortSnapshot($db), 'Hello');
    chatCheck(!str_contains(json_encode($payload), 'maria@example.test'), 'Booking identity excluded from AI');
    chatCheck(str_contains($payload['systemInstruction']['parts'][0]['text'], 'next step toward a stay'), 'Guest-support prompt offers a relevant sales next step');
    $supportContext = websiteChatSupportContext(['state' => 'booking', 'data' => ['guests' => 6, 'check_in' => '2027-10-10', 'email' => 'private@example.test', 'guest_name' => 'Private Guest']]);
    $contextPayload = websiteChatGeminiPayload(resortSnapshot($db), 'May jetski ba?', $supportContext);
    chatCheck($supportContext['guests'] === 6 && $supportContext['booking_in_progress'] && !str_contains(json_encode($contextPayload), 'private@example.test') && !str_contains(json_encode($contextPayload), 'Private Guest'), 'Sales context includes only non-sensitive booking progress');
    chatCheck(websiteChatGeminiText(['promptFeedback' => ['blockReason' => 'SAFETY']]) === null, 'Safety fallback');
    chatCheck(websiteChatGeminiText(['candidates' => [['finishReason' => 'MAX_TOKENS']]]) === null, 'Truncated response fallback');
    chatCheck(websiteChatGeminiText(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => 'Welcome']]]]]]) === 'Welcome', 'Valid provider response');
    $stayId = $answer['draft']['stayId'];
    $stayQuery = $db->prepare('SELECT name, details FROM resort_stays WHERE id = ?'); $stayQuery->execute([$stayId]); $stay = $stayQuery->fetch();
    $stayDetails = json_decode($stay['details'], true);
    $available = static fn(): int => facebookConversationAvailableUnits($db, $stayId, $stay['name'], $start->format('Y-m-d'), $end->format('Y-m-d'), (int) $stayDetails['room_count'], ($stayDetails['style'] ?? '') === 'exclusive');
    $initialUnits = $available();
    $insert = $db->prepare("INSERT INTO bookings (reference_code,guest_name,email,phone,check_in,check_out,guests,stay_type,stay_id,status) VALUES (?, 'Chat test', 'chat@example.test', '', ?, ?, 5, ?, ?, 'pending')");
    $insert->execute(['CHAT-TEST-' . bin2hex(random_bytes(4)), $start->format('Y-m-d'), $end->format('Y-m-d'), $stay['name'], $stayId]);
    $id = (int) $db->lastInsertId();
    chatCheck($available() === $initialUnits, 'Pending request does not block');
    $db->prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?")->execute([$id]);
    chatCheck($available() === max(0, $initialUnits - 1), 'Confirmed booking blocks capacity');
    $db->rollBack();
    echo "Passed website chat routing, shared replies, rate/booking states, modal draft, repeat confirmation, handoff and AI boundary tests. No bookings created.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Website chat test failed: ' . $error->getMessage() . "\n"); exit(1);
}
