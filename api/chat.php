<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/website-chat.php';
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
        $identifier = clientIdentifier('website-chat');
        // Serialize the count and insertion even across fresh browser sessions.
        $lock = $db->prepare('SELECT GET_LOCK(?, 2)'); $lock->execute([$identifier]);
        if ((int) $lock->fetchColumn() !== 1) jsonResponse(['status' => 'error', 'message' => 'Please try again shortly.'], 429);
        try {
            $query = $db->prepare('SELECT COUNT(*) AS hourly, SUM(attempted_at >= NOW() - INTERVAL 1 MINUTE) AS recent FROM request_attempts WHERE identifier_hash = ? AND attempted_at >= NOW() - INTERVAL 1 HOUR');
            $query->execute([$identifier]); $counts = $query->fetch();
            $limited = (int) $counts['hourly'] >= 30 || (int) $counts['recent'] >= 6;
            if (!$limited) $db->prepare('INSERT INTO request_attempts (identifier_hash) VALUES (?)')->execute([$identifier]);
        } finally { $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$identifier]); }
        if ($limited) jsonResponse(['status' => 'error', 'message' => 'Please wait a little before sending another message.'], 429);
        $result = websiteChatReply($db, $_SESSION['chat'], trim($message), $rules);
        websiteChatRecord($_SESSION['chat'], 'visitor', $message);
        websiteChatRecord($_SESSION['chat'], 'assistant', $result['reply']);
    }
    jsonResponse(['status' => 'success', 'history' => $_SESSION['chat']['history'], 'csrf' => $_SESSION['chat']['csrf'], 'greeting' => websiteChatFallback($rules),
        'quickActions' => ['Booking', 'Rates', 'Amenities', 'Location'], 'aiAvailable' => (bool) getenv('GEMINI_API_KEY'), 'handoff' => $_SESSION['chat']['state'] === 'handoff'] + $result);
} catch (Throwable) { jsonResponse(['status' => 'error', 'message' => 'Chat is temporarily unavailable. Please use the booking form or contact our team.'], 503); }
