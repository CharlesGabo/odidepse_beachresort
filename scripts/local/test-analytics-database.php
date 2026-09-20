<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
require_once dirname(__DIR__, 2) . '/includes/analytics/insights.php';
function dbCheck(bool $condition, string $label): void { if (!$condition) throw new RuntimeException($label); }
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1','localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local database only.');
    $db = database(); $db->exec("SET time_zone = '+08:00'");
    dbCheck(analyticsSchemaReady($db), 'Migration 013 installed');
    $before = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();
    $actor = (int) $db->query("SELECT id FROM admin_users WHERE role = 'admin' AND active = 1 LIMIT 1")->fetchColumn();
    dbCheck($actor > 0, 'Local admin exists');
    $db->beginTransaction();
    $insert = $db->prepare("INSERT INTO bookings (reference_code, guest_name, email, phone, check_in, check_out, guests, status) VALUES (?, 'Analytics fixture', '', '', '2027-10-01', '2027-10-03', 2, 'pending')");
    $insert->execute(['AN-TEST-' . bin2hex(random_bytes(5))]); $id = (int) $db->lastInsertId();
    $run = static function (array $input) use ($db, $id, $actor): array {
        $snapshot = financeSnapshot($db, $id);
        financeMutate($db, $id, $actor, $input + ['revision' => (int) $snapshot['finance_revision']]);
        return financeSnapshot($db, $id);
    };
    $reject = static function (array $input, string $label) use ($run): void {
        try { $run($input); } catch (InvalidArgumentException | RuntimeException $error) {
            if ($error instanceof PDOException) throw $error;
            return;
        }
        throw new LogicException($label);
    };
    $reject(['action' => 'record', 'amount' => '100.00', 'kind' => 'payment'], 'Missing total must reject payment');
    $reject(['action' => 'set_total', 'amount' => '0.00', 'reason' => ''], 'Complimentary total requires reason');
    $snapshot = $run(['action' => 'set_total', 'amount' => '0.00', 'reason' => 'Complimentary test']);
    dbCheck($snapshot['agreed_total'] === '0.00', 'Zero total permitted with explanation');
    $snapshot = $run(['action' => 'set_total', 'amount' => '1000.10', 'reason' => 'Agreed package']);
    $payment = ['action' => 'record', 'amount' => '750.05', 'kind' => 'payment', 'paid_on' => analyticsToday(), 'method' => 'cash', 'reference' => '', 'note' => 'Deposit'];
    $snapshot = $run($payment); $paymentId = (int) $snapshot['entries'][0]['id'];
    dbCheck($snapshot['balance'] === '250.05', 'Balance exact');
    $reject($payment, 'Overpayment rejected');
    $reject(['action' => 'set_total', 'amount' => '100.00', 'reason' => 'Too low'], 'Total reduction rejected below net');
    $reject(['action' => 'set_total', 'amount' => '2000.00', 'reason' => 'Stale', 'revision' => 0], 'Stale revision rejected');
    $reject(array_replace($payment, ['kind' => 'refund', 'amount' => '751.00']), 'Excess refund rejected');
    $snapshot = $run(array_replace($payment, ['kind' => 'refund', 'amount' => '250.00', 'note' => 'Refund test']));
    $refundId = (int) $snapshot['entries'][0]['id'];
    dbCheck($snapshot['net_collected'] === '500.05', 'Refund adjusts net');
    $reject(['action' => 'void', 'entry_id' => $paymentId, 'reason' => 'Would create negative net'], 'Dependent void rejected');
    $run(['action' => 'void', 'entry_id' => $refundId, 'reason' => 'Mistaken refund']);
    $snapshot = $run(['action' => 'void', 'entry_id' => $paymentId, 'reason' => 'Mistaken deposit']);
    dbCheck(count($snapshot['entries']) === 2 && $snapshot['net_collected'] === '0.00' && count($snapshot['audit']) === 2, 'Voids preserve ledger and audit');
    $reject(['action' => 'void', 'entry_id' => $paymentId, 'reason' => 'Repeated'], 'Repeated void rejected');
    foreach (['website','website_chat','facebook','manual'] as $source) {
        bookingRecordSource($db, $id, $source);
        $query = $db->prepare('SELECT booking_source FROM bookings WHERE id = ?'); $query->execute([$id]);
        dbCheck($query->fetchColumn() === $source, 'Trusted source ' . $source);
    }
    $db->rollBack();
    dbCheck((int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn() === $before, 'All fixture data rolled back');
    $report = analyticsLoad($db, analyticsFilters([]));
    dbCheck(!isset($report['bookings']) && count($report['forecast']['daily']) === 30, 'Aggregate report loads with forecast');
    $again = analyticsLoad($db, analyticsFilters([]));
    dbCheck($again['data_hash'] === $report['data_hash'] && $again['generated_at'] === $report['generated_at'], 'Identical data reuses cache');
    // Synthetic aggregate-only insights with a separate hash; no external provider call.
    $report['data_hash'] = hash('sha256', 'analytics-test-' . bin2hex(random_bytes(8)));
    $calls = 0; $testActor = PHP_INT_MAX - 100;
    $provider = static function ($payload) use (&$calls): array {
        $calls++;
        return ['summary' => 'History is limited.', 'insights' => [['title' => 'Improve coverage', 'observation' => 'Review missing totals.', 'action' => 'Confirm agreed amounts.', 'confidence' => 'low', 'evidence' => ['missing_totals']]], 'caveat' => 'Review all suggestions before acting.'];
    };
    // Preserve existing global quota during local verification.
    $existingGlobal = $db->query('SELECT * FROM analytics_ai_limits WHERE actor_id = 0')->fetch();
    $insightKey = hash('sha256', $report['data_hash'] . ANALYTICS_PROMPT_VERSION . (getenv('GEMINI_MODEL') ?: 'gemini-3.8-flash'));
    try {
        $first = analyticsInsights($db, $report, $testActor, $provider);
        $second = analyticsInsights($db, $report, $testActor, $provider);
        dbCheck($first['available'] && $second['cached'] && $calls === 1, 'Provider mock and cache');
        $db->prepare('UPDATE analytics_ai_limits SET attempts = 6 WHERE actor_id = ?')->execute([$testActor]);
        try { analyticsClaimAiQuota($db, $testActor); throw new LogicException('Quota must reject'); }
        catch (RuntimeException $error) { dbCheck($error->getCode() === 429, 'Quota enforced'); }
    } finally {
        $db->prepare('DELETE FROM analytics_cache WHERE cache_key = ?')->execute([$insightKey]);
        $db->prepare('DELETE FROM analytics_ai_limits WHERE actor_id = ?')->execute([$testActor]);
        if ($existingGlobal) $db->prepare('UPDATE analytics_ai_limits SET window_start = ?, attempts = ? WHERE actor_id = 0')->execute([$existingGlobal['window_start'], $existingGlobal['attempts']]);
        else $db->exec('DELETE FROM analytics_ai_limits WHERE actor_id = 0');
    }
    echo "Passed local finance ledger, revision conflict, source attribution, report/cache and mocked AI quota tests. All booking fixtures rolled back.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Analytics DB test failed: ' . $error->getMessage() . "\n"); exit(1);
}
