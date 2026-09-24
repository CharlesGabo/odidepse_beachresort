<?php
declare(strict_types=1);

function notificationTemplateEscape(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function notificationTemplateDate(mixed $value): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $value);
    return $date instanceof DateTimeImmutable ? $date->format('D, M j, Y') : (string) $value;
}

function notificationTemplateLongDate(mixed $value): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $value);
    return $date instanceof DateTimeImmutable ? $date->format('l, F j, Y') : (string) $value;
}

function notificationTemplateTime(mixed $value): string
{
    $time = DateTimeImmutable::createFromFormat('!H:i', substr((string) $value, 0, 5));
    return $time instanceof DateTimeImmutable ? $time->format('g:i A') : (string) $value;
}

function notificationTemplateNights(array $booking): ?int
{
    $checkIn = DateTimeImmutable::createFromFormat('!Y-m-d', (string) ($booking['check_in'] ?? ''));
    $checkOut = DateTimeImmutable::createFromFormat('!Y-m-d', (string) ($booking['check_out'] ?? ''));
    if (!$checkIn || !$checkOut || $checkOut <= $checkIn) return null;
    return (int) $checkIn->diff($checkOut)->days;
}

function notificationTemplateStatus(mixed $status): string
{
    return match ((string) $status) {
        'pending' => 'Pending review',
        'confirmed' => 'Confirmed',
        'checked_in' => 'Checked in',
        'completed' => 'Stay completed',
        'cancelled' => 'Cancelled',
        default => ucfirst(str_replace('_', ' ', (string) $status)),
    };
}

function notificationRender(string $type, array $payload): array
{
    [$audience, $event] = array_pad(explode('.', $type, 2), 2, 'notice');
    $isAdmin = $audience === 'admin';
    $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
    $previous = is_array($payload['previous_booking'] ?? null) ? $payload['previous_booking'] : [];
    $digest = is_array($payload['digest'] ?? null) ? $payload['digest'] : [];
    $reference = trim((string) ($booking['reference_code'] ?? ''));
    $guestName = trim((string) ($booking['guest_name'] ?? '')) ?: 'Guest';
    $status = (string) ($booking['status'] ?? '');

    $customerTitles = [
        'created' => 'We received your booking request',
        'updated' => 'Your booking details were updated',
        'room_changed' => 'Your accommodation was updated',
        'confirmed' => 'Your beach stay is confirmed',
        'checked_in' => 'Welcome to Odidepse',
        'completed' => 'Thank you for staying with us',
        'cancelled' => 'Your booking request was cancelled',
        'reminder' => 'Your beach stay begins tomorrow',
    ];
    $adminTitles = [
        'created' => 'New booking request to review',
        'updated' => 'Booking details changed',
        'room_changed' => 'Guest accommodation changed',
        'confirmed' => 'Booking confirmed',
        'checked_in' => 'Guest checked in',
        'completed' => 'Guest stay completed',
        'cancelled' => 'Booking request cancelled',
        'facebook_alert' => 'Facebook needs your attention',
        'facebook_failed' => 'Facebook delivery failed',
        'digest' => 'Today at Odidepse',
        'test' => 'Your email setup is working',
    ];
    $title = ($isAdmin ? $adminTitles : $customerTitles)[$event] ?? 'An update from Odidepse';
    if ($event === 'digest' && $digest) $title = 'Your daily resort briefing';

    $customerIntros = [
        'created' => "Hi {$guestName}, thank you for choosing Odidepse Beach Resort. We have received your request and our team will review your dates and accommodation.",
        'updated' => "Hi {$guestName}, the details of your booking request have been updated. Your latest stay information is below.",
        'room_changed' => "Hi {$guestName}, we have updated the accommodation for your stay. Please review the latest details below.",
        'confirmed' => "Hi {$guestName}, it is official - your stay at Odidepse Beach Resort is confirmed. We look forward to welcoming you.",
        'checked_in' => "Hi {$guestName}, welcome to Odidepse. Settle in, slow down, and enjoy your time by the coast.",
        'completed' => "Hi {$guestName}, thank you for making Odidepse part of your trip. We hope you left with wonderful memories of the coast.",
        'cancelled' => "Hi {$guestName}, your booking request has been cancelled. The details are included below for your records.",
        'reminder' => "Hi {$guestName}, your stay begins tomorrow. We are getting ready to welcome you to the beach.",
    ];
    $adminIntros = [
        'created' => "A new request from {$guestName} is ready for review. Confirm availability and follow up with the guest.",
        'updated' => "The booking for {$guestName} has changed. Review the latest dates and stay details below.",
        'room_changed' => "The assigned accommodation for {$guestName} has been updated.",
        'confirmed' => "The booking for {$guestName} is now confirmed. The operations summary is below.",
        'checked_in' => "{$guestName} has been marked as checked in.",
        'completed' => "{$guestName}'s stay has been marked as completed.",
        'cancelled' => "The booking request for {$guestName} has been cancelled.",
        'facebook_alert' => 'A Facebook conversation needs a staff member to review it.',
        'facebook_failed' => 'A Facebook message could not be delivered and needs review.',
        'digest' => 'Here is the daily operations snapshot for the resort.',
        'test' => 'PHPMailer successfully created and delivered this test message using your current SMTP settings.',
    ];
    $intro = ($isAdmin ? $adminIntros : $customerIntros)[$event] ?? 'Here is the latest update from Odidepse Beach Resort.';
    if ($previous) $intro .= ' Changed details are shown from the previous value to the new value.';

    $subjectTitle = $event === 'created' && !$isAdmin ? 'Booking request received' : $title;
    if ($event === 'digest' && !empty($digest['date'])) $subjectTitle = 'Daily operations | ' . notificationTemplateDate($digest['date']);
    $subject = preg_replace('/[\r\n\x00]+/', ' ', 'Odidepse | ' . $subjectTitle . ($reference ? ' | ' . $reference : '')) ?: 'Odidepse notification';

    $details = [];
    if ($booking) {
        $addDetail = static function (string $label, string $field, mixed $value, callable $format) use (&$details, $previous): void {
            $formatted = $format($value);
            $old = null;
            if (array_key_exists($field, $previous) && (string) $previous[$field] !== (string) $value) $old = $format($previous[$field]);
            $details[] = [$label, $formatted, $old];
        };
        $plain = static fn(mixed $value): string => (string) $value;
        if ($reference !== '') $details[] = ['Booking reference', $reference, null];
        if ($isAdmin) $addDetail('Guest', 'guest_name', $guestName, $plain);
        if ($status !== '') $addDetail('Status', 'status', $status, 'notificationTemplateStatus');
        if (!empty($booking['check_in'])) $addDetail('Check-in', 'check_in', $booking['check_in'], 'notificationTemplateDate');
        if (!empty($booking['preferred_arrival'])) $addDetail('Preferred arrival', 'preferred_arrival', $booking['preferred_arrival'], 'notificationTemplateTime');
        if (!empty($booking['check_out'])) $addDetail('Check-out', 'check_out', $booking['check_out'], 'notificationTemplateDate');
        if (!empty($booking['preferred_departure'])) $addDetail('Preferred departure', 'preferred_departure', $booking['preferred_departure'], 'notificationTemplateTime');
        $nights = notificationTemplateNights($booking);
        if ($nights !== null) {
            $oldNights = $previous ? notificationTemplateNights($previous) : null;
            $nightLabel = static fn(int $count): string => $count . ' ' . ($count === 1 ? 'night' : 'nights');
            $details[] = ['Length of stay', $nightLabel($nights), $oldNights !== null && $oldNights !== $nights ? $nightLabel($oldNights) : null];
        }
        if (isset($booking['guests'])) $addDetail('Guests', 'guests', $booking['guests'], $plain);
        $accommodation = trim((string) ($booking['stay_type'] ?? '')) ?: 'To be arranged';
        $oldAccommodation = trim((string) ($previous['stay_type'] ?? '')) ?: 'To be arranged';
        $details[] = ['Accommodation', $accommodation, $previous && $oldAccommodation !== $accommodation ? $oldAccommodation : null];

        $activityList = static function (array $source): array {
            $activities = [];
            foreach (['service_name', 'requested_activities'] as $field) {
                $activity = trim((string) ($source[$field] ?? ''));
                if ($activity !== '' && !in_array(strtolower($activity), array_map('strtolower', $activities), true)) $activities[] = $activity;
            }
            return $activities;
        };
        $activities = $activityList($booking);
        $oldActivities = $activityList($previous);
        if ($activities || $oldActivities) {
            $activityText = $activities ? implode(', ', $activities) : 'None';
            $oldActivityText = $oldActivities ? implode(', ', $oldActivities) : 'None';
            $details[] = ['Requested activities', $activityText . ' (subject to separate availability)', $previous && $oldActivityText !== $activityText ? $oldActivityText : null];
        }
    }

    $notice = '';
    $noticeTitle = '';
    if ($status === 'pending') {
        $noticeTitle = 'Awaiting confirmation';
        $notice = $isAdmin
            ? 'This request is pending and not confirmed. Review availability before confirming it with the guest.'
            : 'This request is pending and your booking is not confirmed until our team approves it. We will contact you after reviewing availability.';
    } elseif ($event === 'confirmed') {
        $noticeTitle = 'You are all set';
        $notice = $isAdmin ? 'This reservation is confirmed and should now be included in stay preparations.' : 'Your reservation is confirmed. Please keep this email handy for your stay.';
    } elseif ($event === 'reminder') {
        $noticeTitle = 'See you tomorrow';
        $notice = 'If your arrival plans have changed, simply reply to this email and let our team know.';
    }

    $extraSections = [];
    if (!empty($payload['reason'])) $extraSections[] = ['Cancellation reason', (string) $payload['reason']];
    if (!empty($payload['note'])) $extraSections[] = ['A note from our team', (string) $payload['note']];
    if (!empty($payload['summary']) && !($event === 'digest' && $digest)) $extraSections[] = [$event === 'digest' ? 'Operations summary' : 'Details', (string) $payload['summary']];

    $link = '';
    $linkLabel = '';
    if ($isAdmin) {
        $base = rtrim((string) getenv('APP_BASE_URL'), '/');
        if (notificationSafeUrl($base)) {
            $link = $base . '/admin';
            $linkLabel = $event === 'test' ? 'Open admin workspace' : 'Review in admin';
        }
    } elseif ($event === 'completed' && !empty($payload['review_url']) && notificationSafeUrl($payload['review_url'])) {
        $link = (string) $payload['review_url'];
        $linkLabel = 'Share your feedback';
    }

    $reply = (string) (getenv('MAIL_REPLY_TO_ADDRESS') ?: getenv('MAIL_FROM_ADDRESS'));
    $hasReply = notificationAddress($reply);
    $preheader = $reference ? $title . ' - ' . $reference : $intro;
    $escape = 'notificationTemplateEscape';

    $rowsHtml = '';
    foreach ($details as $index => $detail) {
        [$label, $value, $oldValue] = array_pad($detail, 3, null);
        $border = $index === count($details) - 1 ? 'none' : '1px solid #e5e0d4';
        $valueHtml = $oldValue !== null
            ? '<span style="color:#7a8781;font-weight:400">' . $escape($oldValue) . '</span> <span style="padding:0 5px;color:#ef765c">&rarr;</span> <strong style="color:#183b35">' . $escape($value) . '</strong>'
            : '<strong style="color:#183b35">' . $escape($value) . '</strong>';
        $rowsHtml .= '<tr><td style="width:38%;padding:13px 14px 13px 0;border-bottom:' . $border . ';color:#6d7973;font-family:Arial,sans-serif;font-size:12px;line-height:18px;vertical-align:top">' . $escape($label) . '</td><td style="padding:13px 0 13px 14px;border-bottom:' . $border . ';color:#183b35;font-family:Arial,sans-serif;font-size:13px;line-height:18px;vertical-align:top">' . $valueHtml . '</td></tr>';
    }

    $digestHtml = '';
    if ($event === 'digest' && $digest) {
        $groups = is_array($digest['groups'] ?? null) ? $digest['groups'] : [];
        $count = static fn(string $key): int => count(is_array($groups[$key]['items'] ?? null) ? $groups[$key]['items'] : []);
        $metrics = [
            ['Pending review', $count('pending'), '#fff4de', '#8a5a0a'],
            ['Arriving today', $count('arriving_today'), '#eaf5f0', '#17614f'],
            ['Currently checked in', $count('checked_in'), '#edf1e9', '#174f49'],
            ['Departing today', $count('departing_today'), '#f3efe3', '#735f32'],
            ['Overdue check-outs', $count('overdue_departures'), '#fff0ec', '#a84631'],
            ['Possible no-shows', $count('overdue_arrivals'), '#fff0ec', '#a84631'],
            ['Arriving tomorrow', $count('arriving_tomorrow'), '#f3efe3', '#735f32'],
            ['Delivery issues', (int) ($digest['email_issues'] ?? 0) + (int) ($digest['facebook_issues'] ?? 0), '#f4eeee', '#8b3f3f'],
        ];
        $metricRows = '';
        foreach (array_chunk($metrics, 2) as $pair) {
            $metricRows .= '<tr>';
            foreach ($pair as [$label, $value, $background, $color]) {
                $metricRows .= '<td width="50%" style="padding:4px;vertical-align:top"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:' . $background . '"><tr><td style="padding:16px"><p style="margin:0 0 6px;color:' . $color . ';font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase">' . $escape($label) . '</p><p style="margin:0;color:#183b35;font-family:Georgia,Times,serif;font-size:28px;line-height:30px">' . $value . '</p></td></tr></table></td>';
            }
            $metricRows .= '</tr>';
        }
        $dateLabel = notificationTemplateLongDate($digest['date'] ?? '');
        $digestHtml = '<tr><td style="padding:0 0 26px"><p style="margin:0 0 8px;color:#183b35;font-family:Georgia,Times,serif;font-size:19px">' . $escape($dateLabel) . '</p><p style="margin:0 0 14px;color:#6d7973;font-family:Arial,sans-serif;font-size:11px">Asia/Manila &middot; Review urgent items first</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -4px;border-collapse:collapse">' . $metricRows . '</table></td></tr>';

        $sectionOrder = ['arriving_today', 'departing_today', 'overdue_departures', 'overdue_arrivals', 'pending', 'checked_in', 'arriving_tomorrow'];
        foreach ($sectionOrder as $key) {
            $group = is_array($groups[$key] ?? null) ? $groups[$key] : [];
            $items = is_array($group['items'] ?? null) ? array_slice($group['items'], 0, 50) : [];
            if (!$items) continue;
            $accent = in_array($key, ['overdue_departures', 'overdue_arrivals'], true) ? '#ef765c' : ($key === 'pending' ? '#d49328' : '#174f49');
            $itemRows = '';
            foreach ($items as $index => $item) {
                if (!is_array($item)) continue;
                $border = $index === count($items) - 1 ? 'none' : '1px solid #e5e0d4';
                $dates = $escape(notificationTemplateDate($item['check_in'] ?? '')) . ' &rarr; ' . $escape(notificationTemplateDate($item['check_out'] ?? ''));
                $itemRows .= '<tr><td style="padding:13px 0;border-bottom:' . $border . '"><p style="margin:0 0 4px;color:#183b35;font-family:Arial,sans-serif;font-size:13px;font-weight:700">' . $escape($item['guest_name'] ?? 'Guest') . '</p><p style="margin:0;color:#6d7973;font-family:Arial,sans-serif;font-size:10px;line-height:16px">' . $escape($item['reference_code'] ?? '') . ' &middot; ' . $dates . '</p></td></tr>';
            }
            $digestHtml .= '<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:3px solid ' . $accent . ';background:#fbfaf6"><tr><td style="padding:15px 18px 4px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="color:#183b35;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">' . $escape($group['label'] ?? $key) . '</td><td align="right" style="color:' . $accent . ';font-family:Arial,sans-serif;font-size:12px;font-weight:700">' . count($items) . '</td></tr></table></td></tr><tr><td style="padding:0 18px 5px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">' . $itemRows . '</table></td></tr></table></td></tr>';
        }
        $emailIssues = (int) ($digest['email_issues'] ?? 0);
        $facebookIssues = (int) ($digest['facebook_issues'] ?? 0);
        if ($emailIssues + $facebookIssues > 0) {
            $digestHtml .= '<tr><td style="padding:0 0 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fff0ec;border:1px solid #efc0b4"><tr><td style="padding:16px 18px"><p style="margin:0 0 6px;color:#a84631;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Needs attention</p><p style="margin:0;color:#64382f;font-family:Arial,sans-serif;font-size:12px;line-height:20px">Email failures or uncertain deliveries: <strong>' . $emailIssues . '</strong><br>Facebook delivery failures: <strong>' . $facebookIssues . '</strong></p></td></tr></table></td></tr>';
        }
    }

    $extraHtml = '';
    foreach ($extraSections as [$heading, $copy]) {
        $extraHtml .= '<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding:18px 20px;border-left:3px solid #174f49;background:#edf1e9"><p style="margin:0 0 7px;color:#174f49;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">' . $escape($heading) . '</p><p style="margin:0;color:#41544d;font-family:Arial,sans-serif;font-size:13px;line-height:21px;white-space:pre-line">' . nl2br($escape($copy), false) . '</p></td></tr></table></td></tr>';
    }

    $noticeHtml = '';
    if ($notice !== '') {
        $noticeHtml = '<tr><td style="padding:0 0 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding:17px 19px;border:1px solid #efc0b4;background:#fff0ec"><p style="margin:0 0 5px;color:#a84631;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">' . $escape($noticeTitle) . '</p><p style="margin:0;color:#64382f;font-family:Arial,sans-serif;font-size:13px;line-height:20px">' . $escape($notice) . '</p></td></tr></table></td></tr>';
    }

    $buttonHtml = '';
    if ($link !== '') {
        $buttonHtml = '<tr><td style="padding:4px 0 28px"><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="background:#ef765c;border-radius:999px"><a href="' . $escape($link) . '" style="display:inline-block;padding:14px 24px;color:#ffffff;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.1px;text-decoration:none;text-transform:uppercase">' . $escape($linkLabel) . ' &nbsp;&rarr;</a></td></tr></table></td></tr>';
    }

    $contactHtml = $hasReply
        ? 'Questions or changes? Reply to this email or contact <a href="mailto:' . $escape($reply) . '" style="color:#174f49;text-decoration:underline">' . $escape($reply) . '</a>.'
        : 'Questions or changes? Simply reply to this email and our team will help.';

    $body = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $escape($title) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f6f4ec"><div style="display:none;max-height:0;overflow:hidden;opacity:0">' . $escape($preheader) . '</div>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f6f4ec"><tr><td align="center" style="padding:28px 12px">'
        . '<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border-collapse:collapse;background:#ffffff;box-shadow:0 12px 36px rgba(11,48,44,.10)">'
        . '<tr><td style="padding:30px 36px;background:#0b302c;border-bottom:4px solid #ef765c"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td><p style="margin:0;color:#ffffff;font-family:Georgia,Times,serif;font-size:24px;line-height:26px;letter-spacing:-.3px">Odidepse</p><p style="margin:5px 0 0;color:#c4d0ca;font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:2.1px;text-transform:uppercase">Beach Resort &middot; Zambales</p></td><td align="right" style="color:#f3a28e;font-family:Georgia,Times,serif;font-size:22px;white-space:nowrap">&#8767; &#8767;</td></tr></table></td></tr>'
        . '<tr><td style="padding:38px 36px 12px"><p style="margin:0 0 13px;color:#ef765c;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">' . $escape($isAdmin ? 'Resort operations' : 'Your Odidepse stay') . '</p><h1 style="margin:0 0 18px;color:#183b35;font-family:Georgia,Times,serif;font-size:32px;font-weight:400;line-height:38px;letter-spacing:-.5px">' . $escape($title) . '</h1><p style="margin:0;color:#53655e;font-family:Arial,sans-serif;font-size:14px;line-height:23px">' . $escape($intro) . '</p></td></tr>'
        . ($rowsHtml !== '' ? '<tr><td style="padding:18px 36px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #d8d4c9">' . $rowsHtml . '</table></td></tr>' : '<tr><td style="height:20px;line-height:20px">&nbsp;</td></tr>')
        . '<tr><td style="padding:0 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">' . $digestHtml . $noticeHtml . $extraHtml . $buttonHtml . '</table></td></tr>'
        . '<tr><td style="padding:24px 36px;background:#edf1e9;border-top:1px solid #d8ded7"><p style="margin:0;color:#53655e;font-family:Arial,sans-serif;font-size:12px;line-height:20px">' . $contactHtml . '</p></td></tr>'
        . '<tr><td align="center" style="padding:24px 30px;background:#092723"><p style="margin:0 0 6px;color:#ffffff;font-family:Georgia,Times,serif;font-size:15px;font-style:italic">Wild coast. Warm welcome.</p><p style="margin:0;color:#82928d;font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.4px;text-transform:uppercase">Odidepse Beach Resort &middot; San Felipe, Zambales &middot; ' . date('Y') . '</p></td></tr>'
        . '</table></td></tr></table></body></html>';

    $text = strtoupper('Odidepse Beach Resort') . "\n" . $title . "\n\n" . $intro;
    foreach ($details as $detail) {
        [$label, $value, $oldValue] = array_pad($detail, 3, null);
        $text .= "\n" . $label . ': ' . ($oldValue !== null ? $oldValue . ' -> ' : '') . $value;
    }
    if ($event === 'digest' && $digest && !empty($digest['summary'])) $text .= "\n\n" . $digest['summary'];
    if ($notice !== '') $text .= "\n\n" . $noticeTitle . "\n" . $notice;
    foreach ($extraSections as [$heading, $copy]) $text .= "\n\n" . $heading . "\n" . $copy;
    if ($link !== '') $text .= "\n\n" . $linkLabel . ': ' . $link;
    $text .= $hasReply ? "\n\nQuestions or changes? Reply to this email or contact {$reply}." : "\n\nQuestions or changes? Reply to this email.";
    $text .= "\n\nWild coast. Warm welcome.\nOdidepse Beach Resort - San Felipe, Zambales";

    return ['subject' => $subject, 'html' => $body, 'text' => $text];
}
