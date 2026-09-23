<?php
declare(strict_types=1);

function notificationRender(string $type, array $payload): array
{
    $titles = ['created' => 'Booking request received', 'updated' => 'Booking details updated', 'room_changed' => 'Accommodation updated',
        'confirmed' => 'Booking confirmed', 'checked_in' => 'Welcome to Odidepse', 'completed' => 'Thank you for staying with us',
        'cancelled' => 'Booking request cancelled', 'reminder' => 'Your stay is tomorrow', 'facebook_alert' => 'Facebook needs attention',
        'facebook_failed' => 'Facebook delivery failed', 'digest' => 'Daily resort operations', 'test' => 'Email setup test'];
    [$audience, $event] = explode('.', $type, 2);
    $booking = $payload['booking'] ?? [];
    $title = $titles[$event] ?? 'Resort notification';
    $reference = $booking['reference_code'] ?? '';
    $subject = preg_replace('/[\r\n\x00]+/', ' ', 'Odidepse | ' . $title . ($reference ? ' | ' . $reference : ''));
    $lines = [];
    if ($booking) {
        $lines[] = 'Guest: ' . $booking['guest_name'];
        $lines[] = 'Reference: ' . $reference;
        $lines[] = 'Status: ' . str_replace('_', ' ', $booking['status']);
        $lines[] = 'Check-in: ' . $booking['check_in'];
        $lines[] = 'Check-out: ' . $booking['check_out'];
        if (!empty($booking['preferred_arrival'])) $lines[] = 'Preferred arrival time: ' . $booking['preferred_arrival'];
        if (!empty($booking['preferred_departure'])) $lines[] = 'Preferred departure time: ' . $booking['preferred_departure'];
        $lines[] = 'Guests: ' . $booking['guests'];
        $lines[] = 'Accommodation: ' . ($booking['stay_type'] ?: 'To be arranged');
        if (!empty($booking['service_name'])) $lines[] = 'Requested activity: ' . $booking['service_name'] . ' (subject to separate availability confirmation)';
        if (!empty($booking['requested_activities'])) $lines[] = 'Requested activities: ' . $booking['requested_activities'] . ' (subject to separate availability confirmation)';
        if ($booking['status'] === 'pending') $lines[] = 'This request is PENDING. Your booking is not confirmed until our team approves it.';
    }
    if (!empty($payload['reason'])) $lines[] = 'Cancellation reason: ' . $payload['reason'];
    if (!empty($payload['note'])) $lines[] = 'Message from our team: ' . $payload['note'];
    if (!empty($payload['summary'])) $lines[] = $payload['summary'];
    if ($event === 'completed') $lines[] = 'Thank you for choosing Odidepse Beach Resort. We hope you enjoyed your stay.';
    if ($event === 'reminder') $lines[] = 'We look forward to welcoming you tomorrow. Contact our team if your arrival arrangements have changed.';
    if ($event === 'test') $lines[] = 'This message confirms that the resort SMTP configuration accepted a test email.';
    $link = ''; $linkLabel = '';
    if ($audience === 'admin') {
        $base = rtrim((string) getenv('APP_BASE_URL'), '/');
        if (notificationSafeUrl($base)) { $link = $base . '/admin'; $linkLabel = 'Open admin workspace'; }
    } elseif ($event === 'completed' && !empty($payload['review_url']) && notificationSafeUrl($payload['review_url'])) {
        $link = $payload['review_url']; $linkLabel = 'Share your feedback';
    }
    $reply = (string) (getenv('MAIL_REPLY_TO_ADDRESS') ?: getenv('MAIL_FROM_ADDRESS'));
    if (notificationAddress($reply)) $lines[] = 'Questions? Reply to this email or contact ' . $reply . '.';
    $escape = static fn($s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $body = '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f6f3;font-family:Arial,sans-serif;color:#183c33"><main style="max-width:600px;margin:24px auto;padding:28px;background:white;border-radius:12px"><p>ODIDEPSE BEACH RESORT</p><h1 style="font-size:24px">' . $escape($title) . '</h1>';
    foreach ($lines as $line) $body .= '<p style="line-height:1.6;white-space:pre-line">' . $escape($line) . '</p>';
    if ($link) $body .= '<p><a style="color:#17614f" href="' . $escape($link) . '">' . $escape($linkLabel) . '</a></p>';
    $body .= '</main></body></html>';
    return ['subject' => $subject, 'html' => $body, 'text' => $title . "\n\n" . implode("\n\n", $lines) . ($link ? "\n\n" . $linkLabel . ': ' . $link : '')];
}
