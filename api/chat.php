<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/automations/website-chat.php';
$method = requireMethod('GET', 'POST');
websiteChatStart();
try {
    $db = database();
    $rules = facebookSettings($db)['rules'];
    $result = [];
    if ($method === 'POST') {
        websiteChatCsrf();
        $input = readJsonBody(10000);
        if (!in_array($input['action'] ?? null, ['message', 'reset'], true)) jsonResponse(['status' => 'error', 'message' => 'Invalid chat action.'], 422);
        $message = $input['action'] === 'reset' ? 'RESTART' : ($input['message'] ?? null);
        if (!is_string($message) || !mb_check_encoding($message, 'UTF-8') || trim($message) === '' || mb_strlen($message) > 2000) jsonResponse(['status' => 'error', 'message' => 'Enter a message of 1–2,000 characters.'], 422);
        $identifier = clientIdentifier('website-chat-session', session_id());
        $networkIdentifier = clientIdentifier('website-chat-network');
        // Limit rapid bursts per chat session while retaining a generous network
        // ceiling to prevent cookie-reset scripts from bypassing protection.
        $lock = $db->prepare('SELECT GET_LOCK(?, 2)'); $lock->execute([$identifier]);
        if ((int) $lock->fetchColumn() !== 1) jsonResponse(['status' => 'error', 'message' => 'Please try again shortly.'], 429);
        try {
            $query = $db->prepare('SELECT COUNT(*) AS recent, SUM(attempted_at >= NOW() - INTERVAL 5 SECOND) AS burst FROM request_attempts WHERE identifier_hash = ? AND attempted_at >= NOW() - INTERVAL 1 MINUTE');
            $query->execute([$identifier]); $counts = $query->fetch();
            $networkQuery = $db->prepare('SELECT COUNT(*) FROM request_attempts WHERE identifier_hash = ? AND attempted_at >= NOW() - INTERVAL 1 HOUR');
            $networkQuery->execute([$networkIdentifier]);
            $limited = (int) $counts['burst'] >= 4 || (int) $counts['recent'] >= 25 || (int) $networkQuery->fetchColumn() >= 600;
            if (!$limited) {
                $insert = $db->prepare('INSERT INTO request_attempts (identifier_hash) VALUES (?), (?)');
                $insert->execute([$identifier, $networkIdentifier]);
            }
        } finally { $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$identifier]); }
        if ($limited) jsonResponse(['status' => 'error', 'message' => 'Too many messages were sent at once. Please wait a few seconds, then continue.'], 429);
        $result = websiteChatReply($db, $_SESSION['chat'], trim($message), $rules);
        if ($input['action'] !== 'reset') websiteChatRecord($_SESSION['chat'], 'visitor', $message);
        websiteChatRecord($_SESSION['chat'], 'assistant', $result['reply'], $result['photos'] ?? [], $result['photoName'] ?? '');
    }
    jsonResponse(['status' => 'success', 'history' => $_SESSION['chat']['history'], 'csrf' => $_SESSION['chat']['csrf'], 'greeting' => websiteChatFallback($rules),
        'quickActions' => ['Booking', 'Rates', 'Amenities', 'Location'], 'aiAvailable' => (bool) getenv('GEMINI_API_KEY'), 'handoff' => $_SESSION['chat']['state'] === 'handoff'] + $result);
} catch (Throwable) { jsonResponse(['status' => 'error', 'message' => 'Chat is temporarily unavailable. Please use the booking form or contact our team.'], 503); }
