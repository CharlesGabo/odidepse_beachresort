<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/api.php';
require_once dirname(__DIR__) . '/includes/database.php';
requireMethod('GET');

try {
    $statement = database()->query("SELECT guest_name AS display_name, body, received_at FROM facebook_events WHERE kind = 'comment' AND website_status = 'published' ORDER BY website_published_at DESC, id DESC LIMIT 12");
    jsonResponse(['status' => 'success', 'comments' => $statement->fetchAll()]);
} catch (Throwable $error) {
    error_log('Published Facebook comments read failed: ' . get_class($error));
    jsonResponse(['status' => 'error', 'message' => 'Guest comments are temporarily unavailable.'], 503);
}
