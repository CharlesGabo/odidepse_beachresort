<?php
declare(strict_types=1);

/** Integer centavos throughout financial arithmetic; never round browser floats. */
function financeCents(mixed $value): int
{
    if (!is_string($value) || !preg_match('/\A(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?\z/', $value)) {
        throw new InvalidArgumentException('Enter a valid PHP amount with up to two decimal places.');
    }
    $parts = explode('.', $value);
    return (int) $parts[0] * 100 + (int) str_pad($parts[1] ?? '', 2, '0');
}

function financeDecimal(int $cents): string
{
    return ($cents < 0 ? '-' : '') . intdiv(abs($cents), 100) . '.' . str_pad((string) (abs($cents) % 100), 2, '0', STR_PAD_LEFT);
}

function financeText(array $data, string $key, int $max, bool $required = false): string
{
    $value = $data[$key] ?? '';
    if (!is_string($value) || mb_strlen($value) > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F<>]/u', $value) || ($required && trim($value) === '')) {
        throw new InvalidArgumentException('Enter a valid ' . str_replace('_', ' ', $key) . '.');
    }
    return trim($value);
}

function financeBalances(array $entries): array
{
    $paid = $refunded = 0;
    foreach ($entries as $entry) {
        if ($entry['voided_at'] !== null) continue;
        if ($entry['kind'] === 'payment') $paid += financeCents($entry['amount']);
        else $refunded += financeCents($entry['amount']);
    }
    return ['paid' => $paid, 'refunded' => $refunded, 'net' => $paid - $refunded];
}

function financeSnapshot(PDO $db, int $bookingId): array
{
    $query = $db->prepare('SELECT agreed_total, estimated_total, estimate_basis, currency, finance_revision, status FROM bookings WHERE id = ?');
    $query->execute([$bookingId]);
    $booking = $query->fetch();
    if (!$booking) throw new OutOfBoundsException('Booking not found.');
    $query = $db->prepare('SELECT id, kind, amount, paid_on, method, reference, note, created_by, created_at, voided_by, voided_at, void_reason FROM booking_payments WHERE booking_id = ? ORDER BY id DESC');
    $query->execute([$bookingId]);
    $entries = $query->fetchAll();
    $balance = financeBalances($entries);
    $query = $db->prepare('SELECT old_total, new_total, reason, created_by, created_at FROM booking_finance_audit WHERE booking_id = ? ORDER BY id DESC');
    $query->execute([$bookingId]);
    return $booking + ['paid' => financeDecimal($balance['paid']), 'refunded' => financeDecimal($balance['refunded']),
        'net_collected' => financeDecimal($balance['net']),
        'balance' => ($booking['agreed_total'] ?? $booking['estimated_total']) === null ? null : financeDecimal(financeCents($booking['agreed_total'] ?? $booking['estimated_total']) - $balance['net']),
        'entries' => $entries, 'audit' => $query->fetchAll()];
}

function financeRequireTotal(array $booking): void
{
    if ($booking['agreed_total'] === null) throw new InvalidArgumentException('Set the agreed total in booking Finance before recording a transaction.');
}

function financeMutate(PDO $db, int $id, int $actor, array $data): void
{
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) $db->beginTransaction(); else $db->exec('SAVEPOINT booking_finance');
    try {
        $query = $db->prepare('SELECT agreed_total, finance_revision, status FROM bookings WHERE id = ? FOR UPDATE');
        $query->execute([$id]);
        $booking = $query->fetch();
        if (!$booking) throw new OutOfBoundsException('Booking not found.');
        if (!isset($data['revision']) || !is_int($data['revision']) || $data['revision'] !== (int) $booking['finance_revision']) {
            throw new RuntimeException('Finance changed. Reload the latest ledger before saving.', 409);
        }
        $snapshot = financeSnapshot($db, $id);
        $net = financeCents($snapshot['net_collected']);
        $total = $booking['agreed_total'] === null ? null : financeCents($booking['agreed_total']);
        $action = $data['action'] ?? '';
        if ($action === 'set_total') {
            $amount = financeCents($data['amount'] ?? null);
            $reason = financeText($data, 'reason', 500, true);
            if ($amount < $net) throw new InvalidArgumentException('Refund the excess payment before reducing the agreed total.');
            $query = $db->prepare('INSERT INTO booking_finance_audit (booking_id, old_total, new_total, reason, created_by) VALUES (?, ?, ?, ?, ?)');
            $query->execute([$id, $booking['agreed_total'], financeDecimal($amount), $reason, $actor]);
            $db->prepare('UPDATE bookings SET agreed_total = ? WHERE id = ?')->execute([financeDecimal($amount), $id]);
        } elseif ($action === 'record') {
            financeRequireTotal($booking);
            $amount = financeCents($data['amount'] ?? null);
            $kind = $data['kind'] ?? '';
            if (!in_array($kind, ['payment', 'refund'], true) || $amount <= 0) throw new InvalidArgumentException('Choose payment or refund and enter a positive amount.');
            if ($kind === 'payment' && $booking['status'] === 'cancelled') throw new InvalidArgumentException('Cancelled bookings can only receive refunds.');
            if (($kind === 'payment' && $net + $amount > $total) || ($kind === 'refund' && $amount > $net)) throw new InvalidArgumentException('The amount exceeds the available balance.');
            $date = $data['paid_on'] ?? null;
            $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Manila')) : false;
            if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '2000-01-01' || $parsed > new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'))) throw new InvalidArgumentException('Choose a valid payment date, no later than today.');
            $method = $data['method'] ?? '';
            if (!in_array($method, ['cash','gcash','bank_transfer','card','other'], true)) throw new InvalidArgumentException('Choose a valid payment method.');
            $reference = financeText($data, 'reference', 100);
            $note = financeText($data, 'note', 500, $kind === 'refund');
            $query = $db->prepare('INSERT INTO booking_payments (booking_id, kind, amount, paid_on, method, reference, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $query->execute([$id, $kind, financeDecimal($amount), $date, $method, $reference, $note, $actor]);
        } elseif ($action === 'void') {
            $entry = null;
            foreach ($snapshot['entries'] as $row) if ((int) $row['id'] === ($data['entry_id'] ?? null)) $entry = $row;
            if (!$entry || $entry['voided_at'] !== null) throw new InvalidArgumentException('Choose an active ledger entry.');
            $reason = financeText($data, 'reason', 500, true);
            $next = $net + ($entry['kind'] === 'refund' ? 1 : -1) * financeCents($entry['amount']);
            if ($next < 0 || ($total !== null && $next > $total)) throw new InvalidArgumentException('Voiding this entry would invalidate the balance. Correct dependent entries first.');
            $db->prepare('UPDATE booking_payments SET voided_by = ?, voided_at = NOW(), void_reason = ? WHERE id = ? AND booking_id = ? AND voided_at IS NULL')->execute([$actor, $reason, $entry['id'], $id]);
        } else throw new InvalidArgumentException('Choose a valid finance action.');
        $db->prepare('UPDATE bookings SET finance_revision = finance_revision + 1, updated_at = NOW() WHERE id = ?')->execute([$id]);
        if ($ownsTransaction) $db->commit(); else $db->exec('RELEASE SAVEPOINT booking_finance');
    } catch (Throwable $error) {
        if ($db->inTransaction()) { if ($ownsTransaction) $db->rollBack(); else $db->exec('ROLLBACK TO SAVEPOINT booking_finance'); }
        throw $error;
    }
}
