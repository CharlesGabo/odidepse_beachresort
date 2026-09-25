<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/test-analytics.php';
require_once dirname(__DIR__, 2) . '/includes/shared/database.php';
try {
    if (!in_array(requireEnvironment('DB_HOST'), ['127.0.0.1','localhost'], true) || requireEnvironment('DB_NAME') !== 'odidepse_db') throw new RuntimeException('Local test database only.');
    $db = database();
    if (!bookingReportingReady($db)) throw new RuntimeException('Apply migration 016 before the database test.');
    $actor = (int) $db->query('SELECT id FROM admin_users WHERE active=1 LIMIT 1')->fetchColumn();
    if (!$actor) throw new RuntimeException('An existing local admin is required.');
    $stay = $db->query("SELECT * FROM resort_stays WHERE price IS NOT NULL AND price_unit='night' LIMIT 1")->fetch();
    $serviceIds = array_map('intval', $db->query('SELECT id FROM resort_services ORDER BY id LIMIT 2')->fetchAll(PDO::FETCH_COLUMN));
    $db->beginTransaction();
    $q = $db->prepare("INSERT INTO bookings (reference_code,guest_name,email,phone,check_in,check_out,guests,stay_id,stay_type,status) VALUES (?,'Analytics test','analytics@example.test','','2026-01-01','2026-01-03',2,?,?,'pending')");
    $q->execute(['AN-' . bin2hex(random_bytes(6)), $stay['id'], $stay['name']]); $id = (int) $db->lastInsertId();
    bookingReportingCapture($db, $id, 'manual', $serviceIds);
    $snapshot = financeSnapshot($db, $id);
    analyticsCheck($snapshot['estimated_total'] === financeDecimal(financeCents($stay['price']) * 2), 'Persisted estimate');
    $db->prepare('UPDATE resort_stays SET price=price+500 WHERE id=?')->execute([$stay['id']]);
    bookingReportingCapture($db, $id, 'website', $serviceIds);
    analyticsCheck(financeSnapshot($db,$id)['estimated_total']===$snapshot['estimated_total'],'Catalog price change preserves estimate');
    $q=$db->prepare('SELECT booking_source FROM bookings WHERE id=?');$q->execute([$id]);
    analyticsCheck($q->fetchColumn()==='manual','Established source preserved');
    $q=$db->prepare('SELECT COUNT(*) FROM booking_activity_requests WHERE booking_id=?');$q->execute([$id]);
    analyticsCheck((int)$q->fetchColumn()===count($serviceIds),'Multiple activities stored without duplicates');
    financeMutate($db,$id,$actor,['action'=>'set_total','amount'=>'3000.00','reason'=>'Test agreed price','revision'=>0]);
    analyticsReject(fn()=>financeMutate($db,$id,$actor,['action'=>'set_total','amount'=>'4000.00','reason'=>'Stale','revision'=>0]),'Stale finance revision rejected');
    financeMutate($db,$id,$actor,['action'=>'record','kind'=>'payment','amount'=>'2000.00','paid_on'=>'2026-01-01','method'=>'cash','revision'=>1]);
    try { financeMutate($db,$id,$actor,['action'=>'record','kind'=>'payment','amount'=>'1000.01','paid_on'=>'2026-01-01','method'=>'cash','revision'=>2]); throw new RuntimeException('Excess payment accepted.'); }
    catch (InvalidArgumentException $error) { analyticsCheck($error->getMessage()==='You can record up to ₱1,000.00 for this payment.','Payment limit explains the maximum'); }
    try { financeMutate($db,$id,$actor,['action'=>'record','kind'=>'refund','amount'=>'2000.01','paid_on'=>'2026-01-01','method'=>'cash','note'=>'Excess','revision'=>2]); throw new RuntimeException('Excess refund accepted.'); }
    catch (InvalidArgumentException $error) { analyticsCheck($error->getMessage()==='You can refund up to ₱2,000.00 from this booking.','Refund limit explains the maximum'); }
    analyticsReject(fn()=>financeMutate($db,$id,$actor,['action'=>'record','kind'=>'payment','amount'=>'100.00','paid_on'=>'2099-01-01','method'=>'cash','revision'=>2]),'Future payment date rejected');
    financeMutate($db,$id,$actor,['action'=>'record','kind'=>'refund','amount'=>'500.00','paid_on'=>'2026-01-02','method'=>'cash','note'=>'Partial refund','revision'=>2]);
    $snapshot=financeSnapshot($db,$id);
    analyticsCheck($snapshot['net_collected']==='1500.00' && $snapshot['balance']==='1500.00','Payment/refund ledger balance');
    $paymentId=(int)$snapshot['entries'][1]['id']; $refundId=(int)$snapshot['entries'][0]['id'];
    analyticsReject(fn()=>financeMutate($db,$id,$actor,['action'=>'void','entry_id'=>$paymentId,'reason'=>'Cannot void dependent payment','revision'=>3]),'Dependent payment void rejected');
    financeMutate($db,$id,$actor,['action'=>'void','entry_id'=>$refundId,'reason'=>'Refund recorded by mistake','revision'=>3]);
    analyticsCheck(financeSnapshot($db,$id)['net_collected']==='2000.00','Void reverses effect');
    financeMutate($db,$id,$actor,['action'=>'void','entry_id'=>$paymentId,'reason'=>'Payment recorded by mistake','revision'=>4]);
    financeMutate($db,$id,$actor,['action'=>'set_total','amount'=>'0.00','reason'=>'Complimentary','revision'=>5]);
    $snapshot=financeSnapshot($db,$id);
    analyticsCheck($snapshot['balance']==='0.00' && count($snapshot['audit'])===2 && count($snapshot['entries'])===2,'Zero total, audit and void records preserved');
    $db->rollBack();
    $report=analyticsLoad($db,[]);
    analyticsCheck(count($report['monthly'])===12,'Live rolling twelve-month report');
    echo "Passed transactional finance, concurrency, refunds, voids, complimentary totals, audit, source and activity capture, estimate persistence and live reporting. Test rows rolled back.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Analytics database test failed: ' . $error->getMessage() . "\n"); exit(1);
}
