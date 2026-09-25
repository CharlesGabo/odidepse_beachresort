<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/includes/analytics/analytics.php';
function analyticsCheck(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function analyticsReject(callable $action, string $message): void {
    try { $action(); } catch (InvalidArgumentException|RuntimeException $error) { return; }
    throw new LogicException($message);
}
$stays = [['id'=>1,'name'=>'Room A','price'=>'1000.50','price_mode'=>'fixed','price_unit'=>'night'],['id'=>2,'name'=>'Room B','price'=>'2000.00','price_mode'=>'fixed','price_unit'=>'night']];
$base = ['id'=>1,'status'=>'completed','check_in'=>'2025-12-30','check_out'=>'2026-01-02','created_at'=>'2025-11-10 08:00:00','guests'=>4,'stay_id'=>1,'stay_type'=>'Room A','stay_plan_json'=>null,'agreed_total'=>'3000.00','estimated_total'=>'3001.50','booking_source'=>'website'];
[$estimate] = bookingReportingEstimate($base, $stays);
analyticsCheck($estimate === '3001.50', 'Single-room estimate and centavos');
$multi = array_replace($base, ['stay_plan_json'=>json_encode([['stay_id'=>1,'quantity'=>2],['stay_id'=>2,'quantity'=>1]])]);
analyticsCheck(bookingReportingEstimate($multi, $stays)[0] === '12003.00', 'Multi-room quantities');
analyticsCheck(bookingReportingEstimate(array_replace($base,['stay_id'=>null]),$stays)[0] === $estimate,'Legacy exact name match');
analyticsCheck(bookingReportingEstimate($base,[array_replace($stays[0],['price'=>null])])[0] === null,'Missing rates remain unknown');
analyticsCheck(bookingReportingEstimate(array_replace($base,['check_out'=>'2025-02-30']),$stays)[0] === null,'Invalid dates rejected');
analyticsCheck(financeDecimal(-123) === '-1.23','Negative cash formats correctly');
analyticsReject(fn()=>financeCents('1e4'),'Scientific notation rejected');
analyticsReject(fn()=>analyticsFilters(['preset'=>'custom','from'=>'2025-02-30','to'=>'2026-01-01'],'2026-09-25','2025-01-01'),'Invalid filter date');
$filters = analyticsFilters(['preset'=>'custom','from'=>'2025-11-01','to'=>'2026-01-31'],'2026-09-25','2025-01-01');
$bookings = [$base,
    array_replace($base,['id'=>2,'status'=>'cancelled','check_in'=>'2026-01-02','created_at'=>'2026-01-01 12:00:00']),
    array_replace($base,['id'=>3,'status'=>'pending','agreed_total'=>null,'created_at'=>'2026-01-01 12:00:00','check_in'=>'2026-01-10']),
    array_replace($base,['id'=>4,'agreed_total'=>null,'created_at'=>'2026-01-01 12:00:00','check_in'=>'2026-01-10']),
    array_replace($base,['id'=>5,'agreed_total'=>null,'estimated_total'=>null,'check_in'=>'2026-01-10']),
];
$payments = [
    ['booking_id'=>1,'kind'=>'payment','amount'=>'2000.00','paid_on'=>'2025-11-15','voided_at'=>null],
    ['booking_id'=>1,'kind'=>'payment','amount'=>'1000.00','paid_on'=>'2026-02-01','voided_at'=>null],
    ['booking_id'=>2,'kind'=>'refund','amount'=>'500.00','paid_on'=>'2026-01-15','voided_at'=>null],
    ['booking_id'=>1,'kind'=>'payment','amount'=>'10.00','paid_on'=>'2026-01-15','voided_at'=>'2026-01-16'],
];
$activities=[['booking_id'=>1,'service_id'=>1,'service_name'=>'ATV'],['booking_id'=>1,'service_id'=>2,'service_name'=>'Jet ski']];
$report=analyticsReport($bookings,$payments,$activities,$stays,$filters,'2026-09-25'); $m=$report['metrics'];
analyticsCheck($m['booked']==='6001.50' && $m['agreed']==='3000.00' && $m['estimated']==='3001.50','Estimates and agreed totals remain distinct');
analyticsCheck($m['outstanding']==='4001.50','Balance uses cash through report end');
analyticsCheck($m['net']==='1500.00' && $report['monthly'][2]['net']==='-500.00','Cancelled refunds and negative cash months retained');
analyticsCheck($m['pipeline']==='3001.50' && $m['unpriced']===1,'Pending and unknown amounts');
analyticsCheck($m['requests']===5 && $m['stays']===3 && $m['guests']===12,'Request and stay cohorts');
analyticsCheck(count($report['activities'])===2 && $report['activities'][0]['guests']===4,'Multiple activities count each requesting party once');
$year=analyticsReport($bookings,$payments,$activities,$stays,array_replace($filters,['group'=>'year']),'2026-09-25');
analyticsCheck(count($year['series'])===2 && $year['metrics']===$m,'Yearly aggregation preserves totals');
$filtered=analyticsReport($bookings,$payments,$activities,$stays,array_replace($filters,['activity_id'=>2]),'2026-09-25');
analyticsCheck($filtered['metrics']['requests']===1 && $filtered['metrics']['booked']==='3000.00','Activity filter applies to finance and demand');
$rolling=analyticsFilters([], '2026-09-25', '2025-01-01');
analyticsCheck($rolling['from']==='2025-10-01' && $rolling['to']==='2026-09-25','Rolling twelve calendar months');
echo "Passed analytics calculations, date filters, money, estimates, multi-room plans, activity demand, status cohorts and monthly/yearly totals.\n";
