<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

final class FacebookWorkflowError extends RuntimeException {}

function facebookCategories(): array
{
    return ['booking', 'rates', 'amenities', 'location', 'complaint', 'general'];
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
            'booking' => 'Thank you for your inquiry! Please share your preferred dates and number of guests so our team can check availability.',
            'rates' => 'Thank you for asking about our rates. Please share your preferred accommodation, dates, and group size for a quote from our team.',
            'amenities' => 'Thanks for reaching out! Which facilities or activities would you like to know about?',
            'location' => 'Thank you for your interest in Odidepse Beach Resort. Our team will help you with directions.',
            'complaint' => 'We’re sorry to hear about your concern. Please wait for an admin to review your message and assist you as soon as possible.',
            'general' => 'Thank you for contacting Odidepse Beach Resort! How can our team help you?',
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

function facebookPrepareReply(PDO $db, array $event, array $rules, bool $automaticDelivery = false): bool
{
    if ($event['kind'] !== 'message' || $event['status'] === 'resolved') return false;
    $body = $rules['templates'][$event['category']] ?? '';
    if ($body === '') return false;
    $key = 'reply:event:' . $event['id'];
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
    $db->prepare("INSERT INTO facebook_jobs (event_id, kind, dedupe_key, payload, status, error_code) VALUES (?, 'reply', ?, ?, ?, ?)")->execute([$event['id'], $key, $body, $status, $errorCode]);
    return true;
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
