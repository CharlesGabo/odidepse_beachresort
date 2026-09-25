<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/automations/facebook-automations.php';

$first = 'We are half a dozen and want a room in two weeks';
$firstResult = bookingInterpreterValidate(
    ['intent' => 'booking', 'fields' => [['field' => 'guests', 'value' => '6', 'evidence' => 'half a dozen']], 'ambiguous' => ['check_in', 'check_out', 'stay']],
    $first, facebookConversationDetails($first), [], ['stays' => [], 'services' => []]
);
if (($firstResult['fields']['guests'] ?? null) !== 6 || ($firstResult['ambiguous'] ?? []) !== ['check_in', 'check_out']) throw new RuntimeException('Initial interpretation was lost.');
$data = [];
bookingInterpreterApplySafeFields($data, $firstResult);
$data['interpretation_pending'] = $firstResult['ambiguous'];

$followup = 'Check in: October 10, 2027. Check out: October 12, 2027. Arrive: 2 PM. Leave: 11 AM.';
$local = facebookConversationDetails($followup);
if ($local['dates'] !== ['2027-10-10', '2027-10-12'] || $local['check_in_time'] !== '14:00' || $local['check_out_time'] !== '11:00') throw new RuntimeException('Explicit follow-up was parsed incorrectly.');
$secondResult = bookingInterpreterValidate(['intent' => 'booking', 'fields' => [], 'ambiguous' => ['check_out']], $followup, $local, $data, ['stays' => [], 'services' => []]);
if ($secondResult === null || $secondResult['ambiguous'] !== []) throw new RuntimeException('Model uncertainty overrode explicit checkout.');
bookingInterpreterResolvePending($data, $followup, $secondResult);
if (isset($data['interpretation_pending']) || $data['guests'] !== 6) throw new RuntimeException('Clarified dates did not release saved booking progress.');
echo "Passed exact two-message AI booking interpretation regression without database access.\n";
