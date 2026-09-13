<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

final class FacebookWorkflowError extends RuntimeException {}

function facebookCategories(): array
{
    return ['booking', 'rates', 'amenities', 'location', 'complaint', 'general'];
}

function facebookGuidedReplyKeys(): array
{
    return ['start', 'restart', 'ask_dates', 'confirm_dates', 'ask_guests', 'ask_stay', 'ask_contact', 'ask_booking_details', 'ask_rate_details', 'book_from_rates', 'missing_name', 'missing_contact', 'ask_confirmation', 'menu', 'handoff', 'completed', 'cancelled', 'no_options', 'options_intro', 'summary_intro', 'progress_saved', 'invalid_answer', 'confirm_only', 'unavailable', 'pending_created', 'pending_updated'];
}

function facebookDefaultRules(): array
{
    return [
        'categorize' => true,
        'prepare_replies' => true,
        'notify_comments' => true,
        'keywords' => [
            'complaint' => ['complaint', 'refund', 'disappointed', 'disappointing', 'rude', 'unsafe', 'scam', 'reklamo', 'hindi maayos', 'pangit ang serbisyo'],
            'rates' => ['price', 'rate', 'rates', 'cost', 'how much', 'magkano', 'presyo', 'bayad'],
            'booking' => ['book', 'booking', 'reserve', 'reservation', 'availability', 'available', 'vacancy', 'mag-book', 'magpareserve', 'may available', 'bakante'],
            'location' => ['where', 'location', 'address', 'direction', 'directions', 'saan', 'paano pumunta', 'malapit ba', 'direksyon'],
            'amenities' => ['pool', 'wifi', 'parking', 'amenities', 'kayak', 'jetski', 'activities', 'pet', 'pets', 'may pool', 'may wifi', 'pwede pet'],
            'general' => [],
        ],
        'templates' => [
            'booking' => 'Thank you for your booking inquiry! We offer 5-, 8-, 9-, and 10-guest rooms, large-group accommodation, and an entire-building exclusive option for 88–100 guests. Please send your check-in and check-out dates, total number of guests, and preferred room so our team can check availability. Your request is confirmed only after our staff contacts you.',
            'rates' => "Thank you for your inquiry about our rates!\n\nOur rates may vary depending on your dates, number of guests, room arrangement, and optional activities.\n\nTo provide you with the correct rate, please send us:\n• Check-in and check-out dates\n• Total number of guests\n• Preferred accommodation (optional) — e.g. 5-, 8-, 9-, or 10-guest room, large-group accommodation, or entire building. Leave this blank if you want us to suggest the best fit.\n• Requested activities (optional) — ATV, banana boat, or jet ski rental, available upon inquiry\n\nOnce we receive your details, our team will prepare the appropriate quote for your stay.",
            'amenities' => 'Our amenities include air-conditioned rooms, pet-friendly stays, free Wi-Fi up to 800 Mbps, Netflix, HBO Max and Prime Video on the common TV, an LG XBOOM speaker with microphone, a karaoke-friendly common area, shared kitchen with utensils and rice cooker, common refrigerator, water dispenser, griller, tables and chairs. ATV, banana boat and jet ski rentals are available upon inquiry, and large groups may ask about a private pool option.',
            'location' => 'Odidepse Beach Resort is along Purok 8 Coastal Road, Brgy. Sto. Niño, San Felipe, Zambales (Plus Code: 3355+4P). Google Maps: https://www.google.com/maps/search/?api=1&query=Odidepse%20Beach%20Resort%2C%20San%20Felipe%2C%20Zambales We are about a 25-second walk from the beach and approximately four hours from Manila. Transfers are available upon request.',
            'complaint' => 'We’re sorry to hear about your concern. Please wait for an admin to review your message and assist you as soon as possible. Salamat sa inyong pag-unawa.',
            'general' => 'Thank you for contacting Odidepse Beach Resort! We can help with room options, rates, availability, amenities, activities, directions, and group arrangements. Sabihin lamang po kung ano ang kailangan ninyo, including your dates and number of guests if you are planning a stay.',
        ],
        'guided_replies' => [
            'start' => "I'll guide you through a booking request.",
            'restart' => "Let's start your booking request.",
            'ask_dates' => 'When would you like to stay? You can say “next weekend,” “October 10 to 12,” “bukas,” or send {date_example}.',
            'confirm_dates' => 'I understood your stay as {dates}. Is that correct? Reply YES or NO.',
            'ask_guests' => 'How many guests will be staying? You can say “5,” “lima kami,” or “2 adults and 3 kids.”',
            'ask_stay' => 'Reply with the number of your preferred accommodation.',
            'ask_contact' => 'Please send your full name and either your email or mobile number together. Example: Maria Santos, 09171234567.',
            'ask_booking_details' => "Please reply once with:\n\n📅 Stay dates — e.g. September 15–18\n👥 Number of guests — e.g. 8\n🏠 Preferred room — optional; leave this blank and I will suggest the best fit\n👤 Full name\n📞 Mobile number or email\n\nYou may write these in any order.",
            'ask_rate_details' => "To check suitable rates, reply once with:\n\n📅 Stay dates — e.g. September 15–18\n👥 Number of guests — e.g. 8",
            'book_from_rates' => "Want to book? Reply once with:\n\n🏠 Option number\n👤 Full name\n📞 Mobile number or email\n\nExample: Option 1, Maria Santos, 09171234567",
            'missing_name' => 'I got your contact detail. What is your full name?',
            'missing_contact' => 'I got your name. Please send either your email or mobile number.',
            'ask_confirmation' => 'Reply CONFIRM to create this pending request, BACK to change a detail, or CANCEL.',
            'menu' => 'I can help with BOOKING, RATES, AMENITIES, and LOCATION. You can also type BACK, RESTART, or CANCEL.',
            'handoff' => 'An admin will review your concern. Type RESTART if you want to begin a new booking request.',
            'completed' => 'Your request is awaiting staff approval. Type RESTART to begin another booking request.',
            'cancelled' => 'This booking request was cancelled. Type RESTART to begin again.',
            'no_options' => 'No listed accommodation currently fits those dates and group size. An admin will review your request. Type RESTART if you want to try different details.',
            'options_intro' => 'Suitable options for your group (subject to staff approval):',
            'summary_intro' => 'Please review your booking request:',
            'progress_saved' => 'Your booking progress is saved.',
            'invalid_answer' => 'I could not read that answer.',
            'confirm_only' => 'Please reply with exactly CONFIRM, BACK, or CANCEL. No booking has been created yet.',
            'unavailable' => 'That accommodation is no longer available for those dates. Type BACK to choose again.',
            'pending_created' => 'Your booking request {reference} was received.',
            'pending_updated' => 'Your pending booking request {reference} was updated.',
        ],
    ];
}

function facebookSettings(PDO $db): array
{
    $row = $db->query('SELECT revision, rules_json FROM facebook_settings WHERE id = 1')->fetch();
    if (!$row) return ['revision' => 0, 'rules' => facebookDefaultRules()];
    $saved = json_decode($row['rules_json'], true, 16, JSON_THROW_ON_ERROR);
    $defaults = facebookDefaultRules();
    if (!is_array($saved)) $saved = [];
    $rules = array_replace($defaults, $saved);
    $rules['templates'] = array_replace($defaults['templates'], is_array($saved['templates'] ?? null) ? $saved['templates'] : []);
    $rules['keywords'] = array_replace($defaults['keywords'], is_array($saved['keywords'] ?? null) ? $saved['keywords'] : []);
    $rules['guided_replies'] = array_replace($defaults['guided_replies'], is_array($saved['guided_replies'] ?? null) ? $saved['guided_replies'] : []);
    $legacyRatesTemplate = "Thank you for your inquiry about our rates!\n\nOur rates may vary depending on your dates, number of guests, room arrangement, and requested activities.\n\nTo provide you with the correct rate, please send us:\n• Check-in and check-out dates\n• Total number of guests\n• Preferred accommodation\n• Requested activities, if any\n\nATV, banana boat, and jet ski rentals are also available upon inquiry.\n\nOnce we receive your details, our team will prepare the appropriate quote for your stay.";
    if (($rules['templates']['rates'] ?? '') === $legacyRatesTemplate) $rules['templates']['rates'] = $defaults['templates']['rates'];
    $legacyGuidedReplies = [
        'restart' => "Let's start a new booking request.",
        'ask_booking_details' => "Please send all booking details together in one message:\nDates: next weekend, October 10 to 12, or YYYY-MM-DD to YYYY-MM-DD\nGuests: total adults and children\nRoom (optional): 5-, 8-, 9-, or 10-guest room, large group, or entire building. If omitted, I will suggest the best fit.\nName: your full name\nContact: email or mobile number",
        'ask_rate_details' => "To show suitable rates, please send these together:\nDates: next weekend, October 10 to 12, or YYYY-MM-DD to YYYY-MM-DD\nGuests: total adults and children",
        'book_from_rates' => 'To request a booking, reply once with your chosen option number, full name, and email or mobile number. Example: Option 1, Maria Santos, 09171234567.',
    ];
    foreach ($legacyGuidedReplies as $key => $legacyText) {
        if (($rules['guided_replies'][$key] ?? '') === $legacyText) $rules['guided_replies'][$key] = $defaults['guided_replies'][$key];
    }
    return ['revision' => (int) $row['revision'], 'rules' => $rules];
}

function facebookText(array $data, string $key, int $max, bool $required = true): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > $max || ($required && trim($value) === '')) {
        throw new FacebookWorkflowError('Please enter a valid ' . str_replace('_', ' ', $key) . ' (up to ' . $max . ' characters).');
    }
    return trim($value);
}

function facebookCategory(string $body, bool $enabled = true, ?array $keywords = null): string
{
    if (!$enabled) return 'general';
    $sets = $keywords ?? facebookDefaultRules()['keywords'];
    foreach (['complaint', 'rates', 'booking', 'location', 'amenities'] as $category) {
        foreach (is_array($sets[$category] ?? null) ? $sets[$category] : [] as $term) {
            if (!is_string($term) || trim($term) === '') continue;
            $phrase = str_replace(' ', '\\s+', preg_quote(trim($term), '/'));
            if (preg_match('/(?<![\p{L}\p{N}])' . $phrase . '(?![\p{L}\p{N}])/iu', $body)) return $category;
        }
    }
    $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($body, 'UTF-8'), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    foreach (['complaint', 'rates', 'booking', 'location', 'amenities'] as $category) {
        foreach (is_array($sets[$category] ?? null) ? $sets[$category] : [] as $term) {
            if (!is_string($term)) continue;
            $term = mb_strtolower(trim($term), 'UTF-8');
            if (mb_strlen($term) < 5 || preg_match('/[^\p{L}\p{N}]/u', $term)) continue;
            $allowedDistance = mb_strlen($term) >= 9 ? 2 : 1;
            foreach ($words as $word) {
                if (abs(mb_strlen($word) - mb_strlen($term)) > $allowedDistance) continue;
                if (levenshtein($word, $term) <= $allowedDistance) return $category;
            }
        }
    }
    // A recognizable stay date plus a labelled party size is strong booking intent,
    // even when the customer never uses words such as "book" or "available".
    $recognizedDates = facebookConversationDates($body);
    if ($recognizedDates !== null && (facebookConversationGuests($body, true) !== null || preg_match('/\b(?:inquire|inquiry|inq|ask|tanong)\b/iu', $body) === 1)) return 'booking';
    return 'general';
}

function facebookProfileName(array $profile): ?string
{
    $name = $profile['name'] ?? '';
    if (!is_string($name) || !mb_check_encoding($name, 'UTF-8')) return null;
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    return $name !== '' && mb_strlen($name) <= 100 ? $name : null;
}

function facebookAudit(PDO $db, ?int $actor, string $action, string $type, ?int $id): void
{
    // Metadata only: never store message bodies, contacts, tokens, or API error responses in the audit trail.
    $db->prepare('INSERT INTO facebook_audit (actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)')->execute([$actor, $action, $type, $id]);
}

function facebookAutomaticReplyNotice(): string
{
    return 'Automated reply • Reply ADMIN for staff assistance.';
}

function facebookPrepareReply(PDO $db, array $event, array $rules, bool $automaticDelivery = false): bool
{
    if ($event['kind'] !== 'message' || $event['status'] === 'resolved') return false;
    $body = $rules['templates'][$event['category']] ?? '';
    if ($body === '') return false;
    return facebookQueueReply($db, (int) $event['id'], $body, $automaticDelivery);
}

function facebookQueueReply(PDO $db, int $eventId, string $body, bool $automaticDelivery = true, bool $includeAutomaticNotice = true): bool
{
    $body = trim($body);
    if ($eventId < 1 || $body === '' || mb_strlen($body) > 4000) return false;
    if ($automaticDelivery && $includeAutomaticNotice) {
        $notice = facebookAutomaticReplyNotice();
        if (!str_contains($body, $notice)) $body .= "\n\n" . $notice;
    } elseif ($automaticDelivery) {
        $body = json_encode(['__facebook_job_type' => 'handoff_reply', 'text' => $body], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    $key = 'reply:event:' . $eventId;
    $existing = $db->prepare('SELECT id, status FROM facebook_jobs WHERE dedupe_key = ? FOR UPDATE');
    $existing->execute([$key]);
    $job = $existing->fetch();
    $status = $automaticDelivery ? 'pending' : 'blocked';
    $errorCode = $automaticDelivery ? null : 'manual_item';
    if ($job) {
        if ($job['status'] !== 'cancelled') return false;
        $db->prepare('UPDATE facebook_jobs SET payload = ?, status = ?, attempts = 0, next_attempt_at = NULL, error_code = ? WHERE id = ?')->execute([$body, $status, $errorCode, $job['id']]);
        return true;
    }
    $db->prepare("INSERT INTO facebook_jobs (event_id, kind, dedupe_key, payload, status, error_code) VALUES (?, 'reply', ?, ?, ?, ?)")->execute([$eventId, $key, $body, $status, $errorCode]);
    return true;
}

function facebookGuidedReply(array $rules, string $key, array $values = []): string
{
    $templates = array_replace(facebookDefaultRules()['guided_replies'], is_array($rules['guided_replies'] ?? null) ? $rules['guided_replies'] : []);
    $replacements = [];
    foreach ($values as $name => $value) $replacements['{' . $name . '}'] = (string) $value;
    return strtr((string) ($templates[$key] ?? ''), $replacements);
}

function facebookConversationPrompt(string $state, array $rules): string
{
    $exampleStart = (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->modify('+30 days');
    $exampleEnd = $exampleStart->modify('+2 days');
    return match ($state) {
        'awaiting_dates' => facebookGuidedReply($rules, 'ask_dates', ['date_example' => $exampleStart->format('Y-m-d') . ' to ' . $exampleEnd->format('Y-m-d')]),
        'awaiting_dates_confirmation' => facebookGuidedReply($rules, 'confirm_dates', ['dates' => 'the dates shown above']),
        'awaiting_booking_details' => facebookGuidedReply($rules, 'ask_booking_details'),
        'awaiting_rate_details' => facebookGuidedReply($rules, 'ask_rate_details'),
        'awaiting_guests' => facebookGuidedReply($rules, 'ask_guests'),
        'awaiting_stay' => facebookGuidedReply($rules, 'ask_stay'),
        'awaiting_name' => facebookGuidedReply($rules, 'ask_contact'),
        'awaiting_contact' => facebookGuidedReply($rules, 'ask_contact'),
        'awaiting_confirmation' => facebookGuidedReply($rules, 'ask_confirmation'),
        'handoff' => facebookGuidedReply($rules, 'handoff'),
        'completed' => facebookGuidedReply($rules, 'completed'),
        'cancelled' => facebookGuidedReply($rules, 'cancelled'),
        default => 'Type BOOK to start a guided booking request, or ask about rates, amenities, or location.',
    };
}

function facebookConversationCommand(string $body): ?string
{
    $value = trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower($body, 'UTF-8')) ?? '');
    $value = trim(preg_replace('/\b(?:please|pls|po|nga|muna|salamat|thanks)\b/iu', ' ', $value) ?? '');
    $commands = [
        'menu' => ['menu', 'options', 'option', 'help', 'tulong'],
        'back' => ['back', 'balik', 'bumalik', 'previous', 'go back', 'mali'],
        'restart' => ['restart', 'start over', 'ulit', 'simula ulit', 'begin again'],
        'cancel' => ['cancel', 'kansela', 'cancel booking', 'stop booking'],
        'confirm' => ['confirm', 'yes', 'yes confirm', 'oo', 'opo', 'tama', 'correct'],
        'deny' => ['no', 'hindi', 'mali ang date', 'wrong'],
        'staff' => ['admin', 'staff', 'human', 'person', 'talk to staff', 'kausapin admin', 'kausap ng tao'],
    ];
    foreach ($commands as $command => $phrases) if (in_array($value, $phrases, true)) return $command;
    if (preg_match('/\b(?:talk|speak|kausap|kausapin)\b.*\b(?:admin|staff|human|person|tao)\b|\b(?:admin|staff|human)\b.*\b(?:help|assist)\b/iu', $value)) return 'staff';
    if (!str_contains($value, ' ') && mb_strlen($value) >= 3 && mb_strlen($value) <= 9) {
        foreach (['menu' => 'menu', 'back' => 'back', 'balik' => 'back', 'restart' => 'restart', 'cancel' => 'cancel', 'confirm' => 'confirm', 'admin' => 'staff', 'yes' => 'confirm', 'no' => 'deny'] as $word => $command) {
            if (levenshtein($value, $word) <= 1) return $command;
            if (strlen($value) === strlen($word)) for ($index = 0; $index < strlen($value) - 1; $index++) {
                $swapped = $value;
                [$swapped[$index], $swapped[$index + 1]] = [$swapped[$index + 1], $swapped[$index]];
                if ($swapped === $word) return $command;
            }
        }
    }
    return null;
}

function facebookValidConversationDates(DateTimeImmutable $checkIn, DateTimeImmutable $checkOut): ?array
{
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    if ($checkIn < $today || $checkOut <= $checkIn || $checkIn->diff($checkOut)->days > 30) return null;
    return [$checkIn->format('Y-m-d'), $checkOut->format('Y-m-d')];
}

function facebookConversationDateValue(int $year, int $month, int $day, DateTimeZone $timezone): ?DateTimeImmutable
{
    if (!checkdate($month, $day, $year)) return null;
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, $day), $timezone);
}

function facebookConversationDates(string $body): ?array
{
    $timezone = new DateTimeZone('Asia/Manila');
    $today = new DateTimeImmutable('today', $timezone);
    $text = mb_strtolower(trim($body), 'UTF-8');
    $text = strtr($text, ['tomorow'=>'tomorrow','tommorow'=>'tomorrow','wekend'=>'weekend','weeknd'=>'weekend','januari'=>'january','febuary'=>'february','marhc'=>'march','apirl'=>'april','agust'=>'august','septmber'=>'september','octber'=>'october','novmber'=>'november','decemeber'=>'december','enero'=>'january','pebrero'=>'february','marso'=>'march','abril'=>'april','mayo'=>'may','hunyo'=>'june','hulyo'=>'july','agosto'=>'august','setyembre'=>'september','oktubre'=>'october','nobyembre'=>'november','disyembre'=>'december']);
    try {
        if (preg_match('/(\d{4}-\d{2}-\d{2})\s*(?:to|until|hanggang|thru|through|-)\s*(\d{4}-\d{2}-\d{2})/iu', $text, $match) === 1) {
            $start = new DateTimeImmutable($match[1], $timezone); $end = new DateTimeImmutable($match[2], $timezone);
            if ($start->format('Y-m-d') === $match[1] && $end->format('Y-m-d') === $match[2]) return facebookValidConversationDates($start, $end);
        }
        if (preg_match('/\b(?:next|susunod na)\s+weeke?n[dt]\b|\bnext\s+week\s*end\b/iu', $text)) {
            $start = $today->modify('next saturday');
            return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
        if (preg_match('/\b(?:this|ngayong)\s+weeke?n[dt]\b/iu', $text)) {
            $start = strtolower($today->format('l')) === 'saturday' ? $today : $today->modify('next saturday');
            return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
        if (preg_match('/\b(?:tomorrow|bukas)\b/iu', $text)) {
            $start = $today->modify('+1 day');
            if (preg_match('/(?:to|until|hanggang)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miyerkules|huwebes|biyernes|sabado|linggo)/iu', $text, $match)) {
                $days = ['lunes'=>'monday','martes'=>'tuesday','miyerkules'=>'wednesday','huwebes'=>'thursday','biyernes'=>'friday','sabado'=>'saturday','linggo'=>'sunday'];
                $day = $days[$match[1]] ?? $match[1];
                $end = strtolower($start->format('l')) === $day ? $start->modify('+7 days') : $start->modify('next ' . $day);
                return facebookValidConversationDates($start, $end);
            }
            return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
        $months = ['january'=>1,'jan'=>1,'february'=>2,'feb'=>2,'march'=>3,'mar'=>3,'april'=>4,'apr'=>4,'may'=>5,'june'=>6,'jun'=>6,'july'=>7,'jul'=>7,'august'=>8,'aug'=>8,'september'=>9,'sep'=>9,'sept'=>9,'october'=>10,'oct'=>10,'november'=>11,'nov'=>11,'december'=>12,'dec'=>12];
        $monthPattern = implode('|', array_keys($months));
        if (preg_match('/\b(' . $monthPattern . ')\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\s*(?:to|until|hanggang|thru|through|-)\s*(?:(' . $monthPattern . ')\s+)?(\d{1,2})(?:\s*,?\s*(\d{4}))?/iu', $text, $match)) {
            $year = (int) (($match[3] ?? '') ?: (($match[6] ?? '') ?: $today->format('Y'))); $endYear = (int) (($match[6] ?? '') ?: $year);
            $start = facebookConversationDateValue($year, $months[$match[1]], (int) $match[2], $timezone);
            $end = facebookConversationDateValue($endYear, $months[(($match[4] ?? '') ?: $match[1])], (int) $match[5], $timezone);
            if ($start && $end && $start < $today && empty($match[3]) && empty($match[6])) { $start = $start->modify('+1 year'); $end = $end->modify('+1 year'); }
            if ($start && $end && $end <= $start && empty($match[6])) $end = $end->modify('+1 year');
            if ($start && $end) return facebookValidConversationDates($start, $end);
        }
        if (preg_match('/\b(\d{1,2})\s*(?:to|until|hanggang|-)\s*(\d{1,2})\s+(' . $monthPattern . ')(?:\s*,?\s*(\d{4}))?/iu', $text, $match)) {
            $year = (int) (($match[4] ?? '') ?: $today->format('Y'));
            $start = facebookConversationDateValue($year, $months[$match[3]], (int) $match[1], $timezone);
            $end = facebookConversationDateValue($year, $months[$match[3]], (int) $match[2], $timezone);
            if ($start && $end && $start < $today && empty($match[4])) { $start = $start->modify('+1 year'); $end = $end->modify('+1 year'); }
            if ($start && $end) return facebookValidConversationDates($start, $end);
        }
        if (preg_match('/\b(' . $monthPattern . ')\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/iu', $text, $match)) {
            $year = (int) (($match[3] ?? '') ?: $today->format('Y'));
            $start = facebookConversationDateValue($year, $months[$match[1]], (int) $match[2], $timezone);
            if ($start && $start < $today && empty($match[3])) $start = $start->modify('+1 year');
            if ($start) return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
        if (preg_match('/\b(\d{1,2})\s+(' . $monthPattern . ')(?:\s*,?\s*(\d{4}))?/iu', $text, $match)) {
            $year = (int) (($match[3] ?? '') ?: $today->format('Y'));
            $start = facebookConversationDateValue($year, $months[$match[2]], (int) $match[1], $timezone);
            if ($start && $start < $today && empty($match[3])) $start = $start->modify('+1 year');
            if ($start) return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
        if (preg_match('/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\s*(?:to|until|hanggang|-)\s*(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/u', $text, $match)) {
            $year = !empty($match[3]) ? (int) $match[3] : (int) $today->format('Y'); $endYear = !empty($match[6]) ? (int) $match[6] : $year;
            if ($year < 100) $year += 2000; if ($endYear < 100) $endYear += 2000;
            $start = facebookConversationDateValue($year, (int) $match[2], (int) $match[1], $timezone);
            $end = facebookConversationDateValue($endYear, (int) $match[5], (int) $match[4], $timezone);
            if ($start && $end && $start < $today && empty($match[3]) && empty($match[6])) { $start = $start->modify('+1 year'); $end = $end->modify('+1 year'); }
            if ($start && $end) return facebookValidConversationDates($start, $end);
        }
        $days = ['monday'=>'monday','tuesday'=>'tuesday','wednesday'=>'wednesday','thursday'=>'thursday','friday'=>'friday','saturday'=>'saturday','sunday'=>'sunday','lunes'=>'monday','martes'=>'tuesday','miyerkules'=>'wednesday','huwebes'=>'thursday','biyernes'=>'friday','sabado'=>'saturday','linggo'=>'sunday'];
        $dayPattern = implode('|', array_keys($days));
        if (preg_match('/\b(' . $dayPattern . ')\s*(?:to|until|hanggang|-)\s*(' . $dayPattern . ')\b/iu', $text, $match)) {
            $startDay = $days[$match[1]]; $endDay = $days[$match[2]];
            $start = strtolower($today->format('l')) === $startDay ? $today : $today->modify('next ' . $startDay);
            $end = strtolower($start->format('l')) === $endDay ? $start->modify('+7 days') : $start->modify('next ' . $endDay);
            return facebookValidConversationDates($start, $end);
        }
        foreach ($days as $word => $english) if (preg_match('/\b' . $word . '\b/iu', $text)) {
            $start = strtolower($today->format('l')) === $english ? $today : $today->modify('next ' . $english);
            return facebookValidConversationDates($start, $start->modify('+1 day'));
        }
    } catch (Throwable) {}
    return null;
}

function facebookConversationGuests(string $body, bool $requireLabel = false): ?int
{
    $text = mb_strtolower($body, 'UTF-8');
    $numbers = ['one'=>1,'oen'=>1,'two'=>2,'tow'=>2,'three'=>3,'tree'=>3,'four'=>4,'foue'=>4,'five'=>5,'fiev'=>5,'six'=>6,'sxi'=>6,'seven'=>7,'sevn'=>7,'eight'=>8,'eigth'=>8,'nine'=>9,'nien'=>9,'ten'=>10,'eleven'=>11,'twelve'=>12,'thirteen'=>13,'fourteen'=>14,'fifteen'=>15,'sixteen'=>16,'seventeen'=>17,'eighteen'=>18,'nineteen'=>19,'twenty'=>20,'isa'=>1,'solo'=>1,'dalawa'=>2,'dalwa'=>2,'tatlo'=>3,'tatloo'=>3,'apat'=>4,'appa'=>4,'lima'=>5,'limma'=>5,'anim'=>6,'pito'=>7,'walo'=>8,'siyam'=>9,'sampu'=>10,'sampoh'=>10,'labingisa'=>11,'labindalawa'=>12,'labintatlo'=>13,'labingapat'=>14,'labinlima'=>15,'labinganim'=>16,'labimpito'=>17,'labingwalo'=>18,'labinsiyam'=>19,'dalawampu'=>20];
    $normalized = preg_replace_callback('/\b[\p{L}]+\b/u', static fn(array $match): string => isset($numbers[$match[0]]) ? (string) $numbers[$match[0]] : $match[0], $text) ?? $text;
    if (preg_match_all('/(\d{1,3})\s*(?:adult|adults|kid|kids|child|children|bata|matanda|guest|guests|people|person|persons|pax|katao)(?!\s*(?:room|accommodation)\b)/iu', $normalized, $parts) >= 1) {
        $guests = array_sum(array_map('intval', $parts[1]));
        return $guests >= 1 && $guests <= 100 ? $guests : null;
    }
    if ($requireLabel) {
        // A short answer is unambiguous while the bot is waiting for the combined
        // booking details, but do not pull an arbitrary day/year out of a date.
        if (preg_match('/\A\s*(?:we\s*(?:are|re)|kami(?:\s+ay)?|for)?\s*(\d{1,3})\s*(?:kami|po|lang|lahat|total)?\s*\z/iu', $normalized, $match) !== 1) return null;
        $guests = (int) $match[1];
        return $guests >= 1 && $guests <= 100 ? $guests : null;
    }
    if (preg_match('/\b(\d{1,3})\b/u', $normalized, $match) !== 1) return null;
    $guests = (int) $match[1];
    return $guests >= 1 && $guests <= 100 ? $guests : null;
}

function facebookConversationAvailableUnits(PDO $db, int $stayId, string $stayName, string $checkIn, string $checkOut, int $configuredCount, bool $exclusive, ?int $excludeBookingId = null): int
{
    $capacity = $exclusive ? 1 : max(1, $configuredCount);
    $sql = "SELECT check_in, check_out, status FROM bookings WHERE (stay_id = ? OR (stay_id IS NULL AND stay_type = ?)) AND status IN ('pending','confirmed','checked_in') AND check_in < ? AND check_out > ?";
    $parameters = [$stayId, $stayName, $checkOut, $checkIn];
    if ($excludeBookingId !== null) { $sql .= ' AND id <> ?'; $parameters[] = $excludeBookingId; }
    $query = $db->prepare($sql);
    $query->execute($parameters);
    $minimum = $capacity;
    $start = new DateTimeImmutable($checkIn);
    $end = new DateTimeImmutable($checkOut);
    $rows = $query->fetchAll();
    for ($date = $start; $date < $end; $date = $date->modify('+1 day')) {
        $key = $date->format('Y-m-d');
        $used = 0;
        foreach ($rows as $booking) if ($booking['check_in'] <= $key && $booking['check_out'] > $key) $used++;
        $minimum = min($minimum, max(0, $capacity - $used));
    }
    return $minimum;
}

function facebookConversationStayOptions(PDO $db, int $guests, string $checkIn, string $checkOut, ?int $excludeBookingId = null): array
{
    $rows = $db->query("SELECT id, name, price, price_mode, price_unit, details FROM resort_stays WHERE enabled = 1 AND archived = 0 AND availability <> 'unavailable' ORDER BY sort_order, id")->fetchAll();
    $options = [];
    foreach ($rows as $row) {
        $details = json_decode($row['details'], true, 32, JSON_THROW_ON_ERROR);
        $minimum = (int) ($details['min_guests'] ?? 1);
        $maximum = (int) ($details['max_guests'] ?? 0);
        $style = (string) ($details['style'] ?? 'standard');
        if ($guests < $minimum || $guests > $maximum) continue;
        if ($guests <= 10 && $style === 'group') continue;
        if ($guests < 88 && $style === 'exclusive') continue;
        $available = facebookConversationAvailableUnits($db, (int) $row['id'], $row['name'], $checkIn, $checkOut, (int) ($details['room_count'] ?? 0), $style === 'exclusive', $excludeBookingId);
        if ($available < 1) continue;
        $rate = null;
        if ($row['price'] !== null && (float) $row['price'] > 0) {
            $rate = (($row['price_mode'] ?? '') === 'from' ? 'From ' : '') . 'PHP ' . number_format((float) $row['price'], 2);
            if (trim((string) $row['price_unit']) !== '') $rate .= ' / ' . trim((string) $row['price_unit']);
        }
        $photos = array_values(array_filter(array_slice(is_array($details['photos'] ?? null) ? $details['photos'] : [], 0, 3), 'is_string'));
        $options[] = ['id' => (int) $row['id'], 'name' => $row['name'], 'max_guests' => $maximum, 'available' => $available, 'style' => $style, 'rate' => $rate, 'photos' => $photos];
    }
    usort($options, static fn(array $left, array $right): int => [$left['max_guests'], $left['id']] <=> [$right['max_guests'], $right['id']]);
    return array_slice($options, 0, 3);
}

function facebookConversationOfferStays(PDO $db, int $conversationId, array $data, int $eventId, array $rules): string
{
    $options = facebookConversationStayOptions($db, (int) $data['guests'], $data['check_in'], $data['check_out'], isset($data['editing_booking_id']) ? (int) $data['editing_booking_id'] : null);
    if ($options === []) {
        facebookConversationSave($db, $conversationId, 'handoff', $data, $eventId);
        $db->prepare('UPDATE facebook_events SET needs_attention = 1, revision = revision + 1 WHERE id = ?')->execute([$eventId]);
        facebookAudit($db, null, 'conversation_handed_to_staff', 'event', $eventId);
        facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
        return facebookGuidedReply($rules, 'no_options');
    }
    $data['options'] = $options;
    $lines = [];
    foreach ($options as $index => $option) {
        $rate = $option['rate'] ?? null;
        $lines[] = ($index + 1) . '. ' . $option['name'] . ' (up to ' . $option['max_guests'] . ' guests) — ' . ($rate ?: 'rate to be provided by staff');
    }
    facebookConversationSave($db, $conversationId, 'awaiting_stay', $data, $eventId);
    return facebookGuidedReply($rules, 'options_intro') . "\n" . implode("\n", $lines) . "\n\n" . facebookConversationPrompt('awaiting_stay', $rules);
}

function facebookConversationOptionsText(array $options, array $rules): string
{
    $lines = [];
    foreach ($options as $index => $option) $lines[] = ($index + 1) . '. ' . $option['name'] . ' (up to ' . $option['max_guests'] . ' guests) — ' . (($option['rate'] ?? null) ?: 'rate to be provided by staff');
    return facebookGuidedReply($rules, 'options_intro') . "\n" . implode("\n", $lines);
}

function facebookConversationStandaloneRateReply(PDO $db, string $body, array $rules, ?int $excludeBookingId = null): ?string
{
    $details = facebookConversationDetails($body);
    $data = [];
    if ($details['dates'] !== null) [$data['check_in'], $data['check_out']] = $details['dates'];
    if ($details['guests'] !== null) $data['guests'] = $details['guests'];
    $missing = facebookConversationMissingDetails($data, true);
    if ($missing !== []) return facebookConversationDetailsChecklist($data, $missing, true);
    $options = facebookConversationStayOptions($db, (int) $data['guests'], $data['check_in'], $data['check_out'], $excludeBookingId);
    if ($options === []) return facebookGuidedReply($rules, 'no_options');
    return facebookConversationOptionsText($options, $rules);
}

function facebookConversationSelectStay(string $body, array $options): ?array
{
    if (preg_match('/\b(?:option|room)\s*#?\s*([1-3])\b/iu', $body, $match) === 1) return $options[(int) $match[1] - 1] ?? null;
    if (preg_match('/\A\s*([1-3])\s*\z/u', $body, $match) === 1) return $options[(int) $match[1] - 1] ?? null;
    $text = mb_strtolower($body, 'UTF-8');
    foreach ([0 => ['one','first','una','smallest','best fit','recommend'], 1 => ['two','second','dalawa','pangalawa'], 2 => ['three','third','tatlo','pangatlo']] as $index => $words) {
        foreach ($words as $word) if (str_contains($text, $word)) return $options[$index] ?? null;
    }
    foreach ($options as $option) if (mb_stripos($body, $option['name'], 0, 'UTF-8') !== false) return $option;
    return null;
}

function facebookConversationDetails(string $body): array
{
    $identity = facebookConversationIdentityContact($body);
    $guests = facebookConversationGuests($body, true);
    if ($guests === null) {
        foreach (preg_split('/\R/u', $body) ?: [] as $line) {
            $lineGuests = facebookConversationGuests(trim($line), true);
            if ($lineGuests !== null) { $guests = $lineGuests; break; }
        }
    }
    $name = '';
    if (preg_match('/(?:^|[\n,;])\s*(?:name|pangalan)\s*[:=-]?\s*([\p{L}\p{M} .\'\-]{2,100})(?=$|[\n,;])/iu', $body, $match) === 1) $name = trim($match[1]);
    if ($name === '') {
        foreach (preg_split('/[\n,;]+/u', $body) ?: [] as $part) {
            $part = trim($part);
            if (preg_match('/\A[\p{L}\p{M} .\'\-]{2,100}\z/u', $part) !== 1 || preg_match('/\b(?:book|booking|reserve|reservation|available|availability|inquiry|date|guest|pax|room|option|best fit|email|phone|contact|weekend|bukas)\b/iu', $part)) continue;
            $name = trim(preg_replace('/\b(?:name|pangalan|ako si|i am|im)\b\s*[:=-]?/iu', '', $part) ?? '');
            if ($name !== '') break;
        }
    }
    if ($name === '' && ($identity['email'] !== '' || $identity['phone'] !== '')) $name = $identity['guest_name'];
    return ['dates' => facebookConversationDates($body), 'guests' => $guests, 'guest_name' => $name, 'email' => $identity['email'], 'phone' => $identity['phone']];
}

function facebookConversationMissingDetails(array $data, bool $ratesOnly = false): array
{
    $missing = [];
    if (($data['check_in'] ?? '') === '' || ($data['check_out'] ?? '') === '') $missing[] = 'dates';
    if (!isset($data['guests'])) $missing[] = 'total guests';
    if (!$ratesOnly) {
        if (($data['guest_name'] ?? '') === '') $missing[] = 'full name';
        if (($data['email'] ?? '') === '' && ($data['phone'] ?? '') === '') $missing[] = 'email or mobile number';
    }
    return $missing;
}

function facebookConversationDetailsChecklist(array $data, array $missing, bool $ratesOnly = false): string
{
    $hasDates = ($data['check_in'] ?? '') !== '' && ($data['check_out'] ?? '') !== '';
    $dates = $hasDates
        ? (new DateTimeImmutable($data['check_in']))->format('M j') . '–' . (new DateTimeImmutable($data['check_out']))->format('M j, Y')
        : 'Needed';
    $lines = [
        ($hasDates ? '✅' : '❓') . ' Dates: ' . $dates,
        isset($data['guests']) ? '✅ Total pax: ' . $data['guests'] : '❓ Total pax: NOT PROVIDED YET',
    ];
    if (!$ratesOnly) {
        $room = ($data['stay_name'] ?? '') !== ''
            ? $data['stay_name'] . (!empty($data['stay_suggested']) ? ' (suggested)' : '')
            : 'Best fit will be suggested';
        $contact = ($data['email'] ?? '') !== '' ? $data['email'] : (($data['phone'] ?? '') !== '' ? $data['phone'] : 'Needed');
        $lines[] = '🏠 Room: ' . $room;
        $lines[] = ($data['guest_name'] ?? '') !== '' ? '✅ Name: ' . $data['guest_name'] : '❓ Name: Needed';
        $lines[] = $contact !== 'Needed' ? '✅ Contact: ' . $contact : '❓ Contact: Needed';
    }
    $labels = array_map(static fn(string $item): string => match ($item) {
        'dates' => 'stay dates',
        'total guests' => 'number of guests',
        'full name' => 'full name',
        'email or mobile number' => 'mobile number or email',
        default => $item,
    }, $missing);
    $heading = "Here’s what I received:\n\n" . implode("\n", $lines);
    if ($missing === ['total guests']) {
        return $heading
            . "\n\nWe still need the TOTAL NUMBER OF PAX."
            . "\nPlease reply with how many people will stay."
            . "\nExample: 5 pax";
    }
    return $heading . "\n\nPlease send only: " . implode(', ', $labels) . '.';
}

function facebookQueueNativeRoomPhotos(PDO $db, int $eventId, string $pageId, string $senderId): int
{
    $query = $db->prepare('SELECT data_json FROM facebook_conversations WHERE page_id = ? AND sender_id = ? LIMIT 1');
    $query->execute([$pageId, $senderId]);
    $json = $query->fetchColumn();
    if (!is_string($json)) return 0;
    $data = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data) || (int) ($data['room_photo_event_id'] ?? 0) !== $eventId) return 0;
    $photos = array_values(array_filter(array_slice(is_array($data['room_photos'] ?? null) ? $data['room_photos'] : [], 0, 3), 'is_string'));
    if ($photos === []) return 0;
    $roomName = mb_substr((string) ($data['stay_name'] ?? 'Room'), 0, 50);
    $suggested = !empty($data['stay_suggested']);
    $caption = $suggested
        ? 'Here are the photos of the suggested ' . $roomName . ' for your group of ' . (int) ($data['guests'] ?? 0) . ' guests.'
        : 'Here are the photos of the ' . $roomName . ' you requested.';
    $caption .= "\n\nReply CONFIRM to submit.\nReply BACK to edit or CANCEL to stop.";
    $captionPayload = json_encode([
        '__facebook_job_type' => 'room_photo_caption',
        'text' => $caption,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $queued = 0;
    $total = count($photos);
    foreach ($photos as $index => $photoId) {
        $photoPayload = json_encode([
            '__facebook_job_type' => 'room_photo',
            'photo_id' => $photoId,
            'photo_index' => $index,
            'photo_total' => $total,
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $status = $index === 0 ? 'pending' : 'blocked';
        $errorCode = $index === 0 ? null : 'awaiting_previous_photo';
        $insert = $db->prepare("INSERT IGNORE INTO facebook_jobs (event_id, kind, dedupe_key, payload, status, error_code) VALUES (?, 'reply', ?, ?, ?, ?)");
        $insert->execute([$eventId, 'room-photo:event:' . $eventId . ':' . $index, $photoPayload, $status, $errorCode]);
        $queued += $insert->rowCount();
    }
    $captionInsert = $db->prepare("INSERT IGNORE INTO facebook_jobs (event_id, kind, dedupe_key, payload, status, error_code) VALUES (?, 'reply', ?, ?, 'blocked', 'awaiting_photos')");
    $captionInsert->execute([$eventId, 'room-photo-caption:event:' . $eventId, $captionPayload]);
    return $queued + $captionInsert->rowCount();
}

function facebookConversationContact(string $body): ?array
{
    if (preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/iu', $body, $match) === 1 && filter_var($match[0], FILTER_VALIDATE_EMAIL)) {
        return ['email' => mb_strtolower($match[0], 'UTF-8'), 'phone' => ''];
    }
    if (preg_match('/\b(?:phone|mobile|cellphone|contact|cp|tel)(?:\s*(?:number|no\.?))?\s*[:=-]?\s*((?:\+|0)\d[\d()\- \t]{5,}\d)/iu', $body, $match) === 1) {
        $phone = trim($match[1]);
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) >= 7 && strlen($digits) <= 15 && strlen($phone) <= 30) return ['email' => '', 'phone' => $phone];
    }
    if (preg_match('/(?<![\d-])(?:\+|0)\d[\d()\- \t]{5,}\d(?![\d-])/u', $body, $match) === 1) {
        $phone = trim($match[0]);
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) >= 7 && strlen($digits) <= 15 && strlen($phone) <= 30) return ['email' => '', 'phone' => $phone];
    }
    return null;
}

function facebookConversationIdentityContact(string $body): array
{
    $contact = facebookConversationContact($body) ?? ['email' => '', 'phone' => ''];
    $withoutContact = $body;
    if ($contact['email'] !== '') $withoutContact = str_ireplace($contact['email'], ' ', $withoutContact);
    if ($contact['phone'] !== '') $withoutContact = str_replace($contact['phone'], ' ', $withoutContact);
    $withoutContact = preg_replace('/\b(?:my|ang|ako|po|is|ay|i|m|im|this|si|name|pangalan|email|e-mail|mail|phone|mobile|cellphone|contact|number|numero|no|cp|tel|ko|phone\s*no)\b\s*[:=-]?/iu', ' ', $withoutContact) ?? '';
    $name = trim(preg_replace('/[\s,;|\/]+/u', ' ', $withoutContact) ?? '');
    if (mb_strlen($name) < 2 || mb_strlen($name) > 100 || preg_match('/\A[\p{L}\p{M} .\'\-]+\z/u', $name) !== 1) $name = '';
    return ['guest_name' => $name, 'email' => $contact['email'], 'phone' => $contact['phone']];
}

function facebookConversationSummary(array $data, array $rules): string
{
    $contact = ($data['email'] ?? '') !== '' ? $data['email'] : ($data['phone'] ?? '');
    $start = (new DateTimeImmutable($data['check_in']))->format('M j');
    $end = (new DateTimeImmutable($data['check_out']))->format('M j, Y');
    $roomLabel = !empty($data['stay_suggested']) ? 'Suggested room: ' : 'Room: ';
    return facebookGuidedReply($rules, 'summary_intro')
        . "\n\n📅 {$start}–{$end}"
        . "\n👥 {$data['guests']} guests"
        . "\n🏠 {$roomLabel}{$data['stay_name']}"
        . "\n👤 {$data['guest_name']}"
        . "\n📞 {$contact}"
        . "\n\nStatus: PENDING staff approval"
        . (!empty($data['stay_suggested']) ? "\nSuggested based on your group size and availability." : '')
        . (!empty($data['room_photos']) ? "\nRoom photos will follow." : '')
        . "\n\nReply CONFIRM to submit."
        . "\nReply BACK to edit or CANCEL to stop.";
}

function facebookConversationSave(PDO $db, int $id, string $state, array $data, int $eventId, ?int $bookingId = null): void
{
    if ($bookingId === null && isset($data['editing_booking_id'])) $bookingId = (int) $data['editing_booking_id'];
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $db->prepare('UPDATE facebook_conversations SET state = ?, data_json = ?, booking_id = ?, last_event_id = ?, revision = revision + 1 WHERE id = ?')->execute([$state, $json, $bookingId, $eventId, $id]);
}

function facebookConversationConsolidatedReply(PDO $db, int $conversationId, array $data, int $eventId, string $body, array $rules, bool $ratesOnly = false): string
{
    $details = facebookConversationDetails($body);
    if ($details['dates'] !== null) [$data['check_in'], $data['check_out']] = $details['dates'];
    foreach (['guests', 'guest_name', 'email', 'phone'] as $key) if (($details[$key] ?? null) !== null && ($details[$key] ?? '') !== '') $data[$key] = $details[$key];
    $prerequisitesMissing = facebookConversationMissingDetails($data, true);
    if ($prerequisitesMissing !== []) {
        facebookConversationSave($db, $conversationId, $ratesOnly ? 'awaiting_rate_details' : 'awaiting_booking_details', $data, $eventId);
        $missing = $ratesOnly ? $prerequisitesMissing : facebookConversationMissingDetails($data);
        return facebookConversationDetailsChecklist($data, $missing, $ratesOnly);
    }
    $options = facebookConversationStayOptions($db, (int) $data['guests'], $data['check_in'], $data['check_out'], isset($data['editing_booking_id']) ? (int) $data['editing_booking_id'] : null);
    if ($options === []) return facebookConversationOfferStays($db, $conversationId, $data, $eventId, $rules);
    $data['options'] = $options;
    if ($ratesOnly) {
        facebookConversationSave($db, $conversationId, 'awaiting_booking_details', $data, $eventId);
        return facebookConversationOptionsText($options, $rules) . "\n\n" . facebookGuidedReply($rules, 'book_from_rates');
    }
    if (isset($data['stay_id']) && !in_array((int) $data['stay_id'], array_column($options, 'id'), true)) unset($data['stay_id'], $data['stay_name']);
    $requestedSuggestion = preg_match('/\b(?:best\s*fit|recommend(?:ed|ation)?|suggest(?:ed|ion)?)\b/iu', $body) === 1;
    $selection = facebookConversationSelectStay($body, $options);
    $automaticallySuggested = false;
    if ($selection === null && !isset($data['stay_id'])) { $selection = $options[0]; $automaticallySuggested = true; }
    if ($selection !== null) {
        $data['stay_id'] = (int) $selection['id'];
        $data['stay_name'] = $selection['name'];
        $data['stay_suggested'] = $automaticallySuggested || $requestedSuggestion;
        $data['room_photos'] = $selection['photos'] ?? [];
    }
    $missing = facebookConversationMissingDetails($data);
    if ($missing !== []) {
        facebookConversationSave($db, $conversationId, 'awaiting_booking_details', $data, $eventId);
        return facebookConversationDetailsChecklist($data, $missing);
    }
    if (($data['room_photos'] ?? []) !== []) $data['room_photo_event_id'] = $eventId;
    facebookConversationSave($db, $conversationId, 'awaiting_confirmation', $data, $eventId);
    return facebookConversationSummary($data, $rules);
}

function facebookConversationReply(PDO $db, array $event, array $rules): string
{
    $eventId = (int) ($event['id'] ?? 0);
    $pageId = (string) ($event['page_id'] ?? '');
    $senderId = (string) ($event['sender_id'] ?? '');
    $body = trim((string) ($event['body'] ?? ''));
    $category = (string) ($event['category'] ?? 'general');
    if ($eventId < 1 || $pageId === '' || $senderId === '' || $body === '') return '';

    $db->prepare("INSERT IGNORE INTO facebook_conversations (page_id, sender_id, state, data_json) VALUES (?, ?, 'idle', '{}')")->execute([$pageId, $senderId]);
    $query = $db->prepare('SELECT * FROM facebook_conversations WHERE page_id = ? AND sender_id = ? FOR UPDATE');
    $query->execute([$pageId, $senderId]);
    $conversation = $query->fetch();
    if (!$conversation) throw new FacebookWorkflowError('The Messenger conversation could not be opened.');
    $state = (string) $conversation['state'];
    $data = json_decode($conversation['data_json'], true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data)) $data = [];
    $command = facebookConversationCommand($body);

    if ($category === 'complaint') {
        facebookConversationSave($db, (int) $conversation['id'], 'handoff', $data, $eventId, $conversation['booking_id'] === null ? null : (int) $conversation['booking_id']);
        facebookAudit($db, null, 'conversation_handed_to_staff', 'event', $eventId);
        return (string) ($rules['templates']['complaint'] ?? facebookConversationPrompt('handoff', $rules));
    }
    if ($command === 'staff') {
        facebookConversationSave($db, (int) $conversation['id'], 'handoff', $data, $eventId, $conversation['booking_id'] === null ? null : (int) $conversation['booking_id']);
        $db->prepare('UPDATE facebook_events SET needs_attention = 1, revision = revision + 1 WHERE id = ?')->execute([$eventId]);
        facebookAudit($db, null, 'conversation_handed_to_staff', 'event', $eventId);
        facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
        return facebookConversationPrompt('handoff', $rules);
    }
    if ($command === 'restart') {
        facebookConversationSave($db, (int) $conversation['id'], 'awaiting_booking_details', [], $eventId);
        return facebookGuidedReply($rules, 'restart') . "\n\n" . facebookGuidedReply($rules, 'ask_booking_details');
    }
    if ($command === 'cancel') {
        if (isset($data['editing_booking_id'])) {
            facebookConversationSave($db, (int) $conversation['id'], 'completed', $data, $eventId, (int) $data['editing_booking_id']);
            return 'Your changes were cancelled. Your existing booking request remains pending.';
        }
        facebookConversationSave($db, (int) $conversation['id'], 'cancelled', [], $eventId);
        return facebookConversationPrompt('cancelled', $rules);
    }
    if ($command === 'menu') {
        return facebookGuidedReply($rules, 'menu') . "\n\n" . facebookConversationPrompt($state, $rules);
    }
    if ($command === 'back') {
        $previous = ['awaiting_dates_confirmation' => 'awaiting_dates', 'awaiting_guests' => 'awaiting_dates', 'awaiting_stay' => 'awaiting_guests', 'awaiting_name' => 'awaiting_stay', 'awaiting_contact' => 'awaiting_stay', 'awaiting_confirmation' => 'awaiting_contact'];
        if (!isset($previous[$state])) return facebookConversationPrompt($state, $rules);
        $state = $previous[$state];
        foreach (match ($state) {
            'awaiting_dates' => ['check_in', 'check_out', 'guests', 'options', 'stay_id', 'stay_name', 'guest_name', 'email', 'phone'],
            'awaiting_guests' => ['guests', 'options', 'stay_id', 'stay_name', 'guest_name', 'email', 'phone'],
            'awaiting_stay' => ['stay_id', 'stay_name', 'guest_name', 'email', 'phone'],
            'awaiting_name' => ['guest_name', 'email', 'phone'],
            default => ['email', 'phone'],
        } as $key) unset($data[$key]);
        facebookConversationSave($db, (int) $conversation['id'], $state, $data, $eventId);
        return facebookConversationPrompt($state, $rules);
    }

    if ($state === 'awaiting_confirmation') {
        $revisionDetails = facebookConversationDetails($body);
        if ($revisionDetails['dates'] !== null || $revisionDetails['guests'] !== null) {
            if ($revisionDetails['dates'] !== null) {
                $revisedData = array_intersect_key($data, array_flip(['guest_name', 'email', 'phone', 'editing_booking_id', 'reference']));
            } else {
                $revisedData = $data;
                foreach (['options', 'stay_id', 'stay_name', 'stay_suggested', 'room_photos', 'room_photo_event_id'] as $key) unset($revisedData[$key]);
            }
            return facebookConversationConsolidatedReply($db, (int) $conversation['id'], $revisedData, $eventId, $body, $rules);
        }
    }

    // A rates-only side question leaves the booking untouched. If the customer
    // includes new trip details, begin a revised booking draft, retain their
    // identity/contact, and collect only the remaining trip information.
    if ($category === 'rates' && !in_array($state, ['idle', 'cancelled', 'awaiting_rate_details'], true)) {
        $rateDetails = facebookConversationDetails($body);
        if ($rateDetails['dates'] === null && $rateDetails['guests'] === null) return (string) ($rules['templates']['rates'] ?? '');
        $revisedData = array_intersect_key($data, array_flip(['guest_name', 'email', 'phone', 'editing_booking_id', 'reference']));
        if ($state === 'completed' && $conversation['booking_id'] !== null) $revisedData['editing_booking_id'] = (int) $conversation['booking_id'];
        return facebookConversationConsolidatedReply($db, (int) $conversation['id'], $revisedData, $eventId, $body, $rules);
    }

    if (in_array($state, ['idle', 'cancelled'], true)) {
        if ($category === 'rates') {
            facebookAudit($db, null, 'rate_conversation_started', 'event', $eventId);
            return facebookConversationConsolidatedReply($db, (int) $conversation['id'], [], $eventId, $body, $rules, true);
        }
        if ($category === 'booking') {
            facebookAudit($db, null, 'conversation_started', 'event', $eventId);
            return facebookConversationConsolidatedReply($db, (int) $conversation['id'], [], $eventId, $body, $rules);
        }
        return (string) ($rules['templates'][$category] ?? $rules['templates']['general'] ?? '');
    }
    if ($state === 'awaiting_booking_details' && in_array($category, ['rates', 'amenities', 'location'], true)) {
        $sideDetails = facebookConversationDetails($body);
        if ($sideDetails['dates'] === null && $sideDetails['guests'] === null && $sideDetails['email'] === '' && $sideDetails['phone'] === '') {
            return (string) ($rules['templates'][$category] ?? '');
        }
    }
    if ($state === 'awaiting_rate_details') return facebookConversationConsolidatedReply($db, (int) $conversation['id'], $data, $eventId, $body, $rules, true);
    if ($state === 'awaiting_booking_details') return facebookConversationConsolidatedReply($db, (int) $conversation['id'], $data, $eventId, $body, $rules);
    if ($state === 'completed') {
        if ($category === 'booking') {
            $bookingId = $conversation['booking_id'] === null ? 0 : (int) $conversation['booking_id'];
            $bookingQuery = $db->prepare('SELECT id, reference_code, guest_name, email, phone, guests, stay_id, stay_type, status FROM bookings WHERE id = ? FOR UPDATE');
            $bookingQuery->execute([$bookingId]);
            $booking = $bookingQuery->fetch();
            if (!$booking || $booking['status'] !== 'pending') {
                facebookConversationSave($db, (int) $conversation['id'], 'handoff', $data, $eventId, $bookingId ?: null);
                $db->prepare('UPDATE facebook_events SET needs_attention = 1, revision = revision + 1 WHERE id = ?')->execute([$eventId]);
                facebookAudit($db, null, 'booking_change_handed_to_staff', 'event', $eventId);
                facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
                return 'This booking can no longer be changed automatically. An admin will review your message and assist you.';
            }
            $data = [
                'editing_booking_id' => (int) $booking['id'], 'reference' => $booking['reference_code'],
                'guest_name' => $booking['guest_name'], 'email' => $booking['email'], 'phone' => $booking['phone'],
                'guests' => (int) $booking['guests'], 'stay_id' => $booking['stay_id'] === null ? null : (int) $booking['stay_id'],
                'stay_name' => $booking['stay_type'],
            ];
            facebookAudit($db, null, 'conversation_restarted', 'event', $eventId);
            return "I'll update your pending request {$booking['reference_code']}.\n\n" . facebookConversationConsolidatedReply($db, (int) $conversation['id'], $data, $eventId, $body, $rules);
        }
        return (string) ($rules['templates'][$category] ?? $rules['templates']['general'] ?? '');
    }
    if ($state === 'handoff') return facebookConversationPrompt('handoff', $rules);

    if (in_array($state, ['awaiting_dates', 'awaiting_dates_confirmation', 'awaiting_guests', 'awaiting_stay', 'awaiting_name', 'awaiting_contact'], true)) {
        return facebookConversationConsolidatedReply($db, (int) $conversation['id'], $data, $eventId, $body, $rules);
    }

    if ($state === 'awaiting_name') $state = 'awaiting_contact'; // Upgrade older in-progress conversations to the combined step.
    if ($state === 'awaiting_dates') {
        $dates = facebookConversationDates($body);
        if ($dates !== null) {
            [$data['check_in'], $data['check_out']] = $dates;
            $includedGuests = facebookConversationGuests($body, true);
            if ($includedGuests !== null) $data['guests'] = $includedGuests;
            unset($data['invalid_attempts']);
            facebookConversationSave($db, (int) $conversation['id'], 'awaiting_dates_confirmation', $data, $eventId);
            $friendlyDates = (new DateTimeImmutable($data['check_in']))->format('F j, Y') . ' to ' . (new DateTimeImmutable($data['check_out']))->format('F j, Y');
            return facebookGuidedReply($rules, 'confirm_dates', ['dates' => $friendlyDates]);
        }
    } elseif ($state === 'awaiting_dates_confirmation') {
        $replacement = facebookConversationDates($body);
        if ($replacement !== null) {
            [$data['check_in'], $data['check_out']] = $replacement;
            $includedGuests = facebookConversationGuests($body, true);
            if ($includedGuests !== null) $data['guests'] = $includedGuests;
            facebookConversationSave($db, (int) $conversation['id'], $state, $data, $eventId);
            $friendlyDates = (new DateTimeImmutable($data['check_in']))->format('F j, Y') . ' to ' . (new DateTimeImmutable($data['check_out']))->format('F j, Y');
            return facebookGuidedReply($rules, 'confirm_dates', ['dates' => $friendlyDates]);
        }
        if ($command === 'confirm') {
            unset($data['invalid_attempts']);
            if (isset($data['guests'])) return facebookConversationOfferStays($db, (int) $conversation['id'], $data, $eventId, $rules);
            facebookConversationSave($db, (int) $conversation['id'], 'awaiting_guests', $data, $eventId);
            return facebookConversationPrompt('awaiting_guests', $rules);
        }
        if ($command === 'deny') {
            unset($data['check_in'], $data['check_out'], $data['invalid_attempts']);
            facebookConversationSave($db, (int) $conversation['id'], 'awaiting_dates', $data, $eventId);
            return facebookConversationPrompt('awaiting_dates', $rules);
        }
    } elseif ($state === 'awaiting_guests') {
        $guests = facebookConversationGuests($body);
        if ($guests !== null) {
            $data['guests'] = $guests;
            unset($data['invalid_attempts']);
            return facebookConversationOfferStays($db, (int) $conversation['id'], $data, $eventId, $rules);
        }
    } elseif ($state === 'awaiting_stay') {
        $selection = null;
        if (preg_match('/\b([1-3])\b/u', $body, $match) === 1) $selection = $data['options'][(int) $match[1] - 1] ?? null;
        if ($selection === null) {
            $choiceText = mb_strtolower($body, 'UTF-8');
            foreach ([0 => ['one','first','una','smallest'], 1 => ['two','second','dalawa','pangalawa'], 2 => ['three','third','tatlo','pangatlo']] as $index => $words) {
                foreach ($words as $word) if (preg_match('/\b' . preg_quote($word, '/') . '\b/iu', $choiceText)) { $selection = $data['options'][$index] ?? null; break 2; }
            }
        }
        if ($selection === null) foreach ($data['options'] ?? [] as $option) if (mb_stripos($body, $option['name'], 0, 'UTF-8') !== false) { $selection = $option; break; }
        if (is_array($selection)) {
            $data['stay_id'] = (int) $selection['id'];
            $data['stay_name'] = (string) $selection['name'];
            unset($data['invalid_attempts']);
            if (isset($data['editing_booking_id']) && ($data['guest_name'] ?? '') !== '' && (($data['email'] ?? '') !== '' || ($data['phone'] ?? '') !== '')) {
                facebookConversationSave($db, (int) $conversation['id'], 'awaiting_confirmation', $data, $eventId);
                return facebookConversationSummary($data, $rules);
            }
            facebookConversationSave($db, (int) $conversation['id'], 'awaiting_contact', $data, $eventId);
            return facebookConversationPrompt('awaiting_contact', $rules);
        }
    } elseif ($state === 'awaiting_contact') {
        $identity = facebookConversationIdentityContact($body);
        foreach (['guest_name', 'email', 'phone'] as $key) if (($identity[$key] ?? '') !== '') $data[$key] = $identity[$key];
        $hasName = ($data['guest_name'] ?? '') !== '';
        $hasContact = ($data['email'] ?? '') !== '' || ($data['phone'] ?? '') !== '';
        if ($hasName && $hasContact) {
            unset($data['invalid_attempts']);
            facebookConversationSave($db, (int) $conversation['id'], 'awaiting_confirmation', $data, $eventId);
            return facebookConversationSummary($data, $rules);
        }
        facebookConversationSave($db, (int) $conversation['id'], 'awaiting_contact', $data, $eventId);
        return facebookGuidedReply($rules, $hasName ? 'missing_contact' : ($hasContact ? 'missing_name' : 'ask_contact'));
    } elseif ($state === 'awaiting_confirmation' && $command === 'confirm') {
        $stay = $db->prepare('SELECT id, name, details FROM resort_stays WHERE id = ? AND enabled = 1 AND archived = 0 LIMIT 1');
        $stay->execute([(int) $data['stay_id']]);
        $stayRecord = $stay->fetch();
        if (!$stayRecord) return facebookGuidedReply($rules, 'unavailable');
        $stayDetails = json_decode($stayRecord['details'], true, 32, JSON_THROW_ON_ERROR);
        $editingBookingId = isset($data['editing_booking_id']) ? (int) $data['editing_booking_id'] : null;
        if (facebookConversationAvailableUnits($db, (int) $stayRecord['id'], $stayRecord['name'], $data['check_in'], $data['check_out'], (int) ($stayDetails['room_count'] ?? 0), ($stayDetails['style'] ?? '') === 'exclusive', $editingBookingId) < 1) return facebookGuidedReply($rules, 'unavailable');
        if ($editingBookingId !== null) {
            $bookingQuery = $db->prepare('SELECT id, reference_code, status FROM bookings WHERE id = ? FOR UPDATE');
            $bookingQuery->execute([$editingBookingId]);
            $booking = $bookingQuery->fetch();
            if (!$booking || $booking['status'] !== 'pending') {
                facebookConversationSave($db, (int) $conversation['id'], 'handoff', $data, $eventId, $editingBookingId);
                $db->prepare('UPDATE facebook_events SET needs_attention = 1, revision = revision + 1 WHERE id = ?')->execute([$eventId]);
                facebookAudit($db, null, 'booking_change_handed_to_staff', 'event', $eventId);
                facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
                return 'This booking can no longer be changed automatically. An admin will review your message and assist you.';
            }
            $update = $db->prepare('UPDATE bookings SET guest_name = ?, email = ?, phone = ?, check_in = ?, check_out = ?, guests = ?, stay_type = ?, stay_id = ?, message = ? WHERE id = ? AND status = \'pending\'');
            $update->execute([$data['guest_name'], $data['email'] ?? '', $data['phone'] ?? '', $data['check_in'], $data['check_out'], (int) $data['guests'], $stayRecord['name'], (int) $stayRecord['id'], 'Updated through the Messenger guided booking assistant. Staff confirmation is required.', $editingBookingId]);
            $reference = (string) $booking['reference_code'];
            $data['reference'] = $reference;
            unset($data['editing_booking_id']);
            facebookConversationSave($db, (int) $conversation['id'], 'completed', $data, $eventId, $editingBookingId);
            $db->prepare("UPDATE facebook_events SET booking_id = ?, status = 'converted', needs_attention = 1, revision = revision + 1 WHERE id = ?")->execute([$editingBookingId, $eventId]);
            facebookAudit($db, null, 'pending_booking_updated', 'booking', $editingBookingId);
            facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
            return facebookGuidedReply($rules, 'pending_updated', ['reference' => $reference]) . ' It is still PENDING and is not confirmed until staff approves it.';
        }
        $reference = 'OD-' . date('ym') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $insert = $db->prepare("INSERT INTO bookings (reference_code, guest_name, email, phone, check_in, check_out, guests, stay_type, message, status, stay_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)");
        $insert->execute([$reference, $data['guest_name'], $data['email'] ?? '', $data['phone'] ?? '', $data['check_in'], $data['check_out'], (int) $data['guests'], $stayRecord['name'], 'Created through the Messenger guided booking assistant. Staff confirmation is required.', (int) $stayRecord['id']]);
        $bookingId = (int) $db->lastInsertId();
        $data['reference'] = $reference;
        facebookConversationSave($db, (int) $conversation['id'], 'completed', $data, $eventId, $bookingId);
        $db->prepare("UPDATE facebook_events SET booking_id = ?, status = 'converted', needs_attention = 1, revision = revision + 1 WHERE id = ?")->execute([$bookingId, $eventId]);
        facebookAudit($db, null, 'pending_booking_created', 'booking', $bookingId);
        facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
        return facebookGuidedReply($rules, 'pending_created', ['reference' => $reference]) . ' This request is PENDING and is not confirmed until staff approves it. Our staff will contact you using the details you provided.';
    }

    if (in_array($category, ['rates', 'amenities', 'location'], true)) {
        return (string) ($rules['templates'][$category] ?? '');
    }
    if ($state === 'awaiting_confirmation') return facebookGuidedReply($rules, 'confirm_only');
    $attempts = (int) ($data['invalid_attempts'] ?? 0) + 1;
    $data['invalid_attempts'] = $attempts;
    if ($attempts >= 3) {
        facebookConversationSave($db, (int) $conversation['id'], 'handoff', $data, $eventId);
        $db->prepare('UPDATE facebook_events SET needs_attention = 1, revision = revision + 1 WHERE id = ?')->execute([$eventId]);
        facebookAudit($db, null, 'conversation_handed_to_staff', 'event', $eventId);
        facebookAudit($db, null, 'staff_alert_created', 'event', $eventId);
        return facebookConversationPrompt('handoff', $rules);
    }
    facebookConversationSave($db, (int) $conversation['id'], $state, $data, $eventId);
    return facebookGuidedReply($rules, 'invalid_answer') . ' ' . facebookConversationPrompt($state, $rules);
}

// Transport-independent failure policy for the future Meta worker. Ambiguous send
// outcomes are terminal until reconciled, to avoid duplicate posts or messages.
function facebookRetryDecision(int $attempts, int $httpStatus, bool $transient, bool $ambiguous = false, int $retryAfter = 0): array
{
    $retry = !$ambiguous && $attempts < 5 && ($httpStatus === 429 || $httpStatus >= 500 || $transient);
    if (in_array($httpStatus, [400, 401, 403, 404], true) && !$transient) $retry = false;
    return [
        'status' => $retry ? 'retry_wait' : 'failed',
        'delay' => $retry ? min(86400, max($retryAfter, 60 * (2 ** min(10, max(0, $attempts - 1))))) : null,
        'error_code' => $ambiguous ? 'delivery_unconfirmed' : ($retry ? 'temporary_failure' : 'delivery_failed'),
    ];
}

function facebookRecordFailure(PDO $db, int $jobId, int $httpStatus, bool $transient, bool $ambiguous = false, int $retryAfter = 0): void
{
    $db->beginTransaction();
    try {
        $query = $db->prepare("SELECT attempts FROM facebook_jobs WHERE id = ? AND status = 'processing' FOR UPDATE");
        $query->execute([$jobId]);
        $job = $query->fetch();
        if (!$job) throw new FacebookWorkflowError('This job is no longer processing.');
        $result = facebookRetryDecision((int) $job['attempts'], $httpStatus, $transient, $ambiguous, $retryAfter);
        $db->prepare('UPDATE facebook_jobs SET status = ?, next_attempt_at = TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP), error_code = ? WHERE id = ?')->execute([$result['status'], $result['delay'], $result['error_code'], $jobId]);
        facebookAudit($db, null, $result['status'], 'job', $jobId);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}
