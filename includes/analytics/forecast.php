<?php
declare(strict_types=1);

const ANALYTICS_MODEL_VERSION = 'ridge-weekday-v1';

function forecastFeatures(array $values, array $dates, int $index, float $scale, bool $annual): array
{
    $date = new DateTimeImmutable($dates[$index]);
    $weekday = (int) $date->format('N');
    $features = [1.0, $index / 365.25];
    for ($day = 2; $day <= 7; $day++) $features[] = $weekday === $day ? 1.0 : 0.0;
    $phase = 2 * M_PI * (int) $date->format('z') / 365.25;
    $features[] = $annual ? sin($phase) : 0.0;
    $features[] = $annual ? cos($phase) : 0.0;
    $features[] = ($values[$index - 7] ?? 0) / $scale;
    $features[] = ($values[$index - 14] ?? 0) / $scale;
    $features[] = array_sum(array_slice($values, max(0, $index - 28), min(28, $index))) / max(1, min(28, $index)) / $scale;
    return $features;
}

/** Small regularized least-squares system solved with partial-pivot elimination. */
function forecastRidge(array $values, array $dates): array
{
    $size = 13;
    $matrix = array_fill(0, $size, array_fill(0, $size + 1, 0.0));
    $scale = max(1.0, max($values));
    $annual = count($values) >= 730;
    for ($index = 28; $index < count($values); $index++) {
        $x = forecastFeatures($values, $dates, $index, $scale, $annual);
        for ($row = 0; $row < $size; $row++) {
            for ($col = 0; $col < $size; $col++) $matrix[$row][$col] += $x[$row] * $x[$col];
            $matrix[$row][$size] += $x[$row] * $values[$index] / $scale;
        }
    }
    for ($index = 0; $index < $size; $index++) $matrix[$index][$index] += $index === 0 ? 0.000001 : 0.1;
    for ($col = 0; $col < $size; $col++) {
        $pivot = $col;
        for ($row = $col + 1; $row < $size; $row++) if (abs($matrix[$row][$col]) > abs($matrix[$pivot][$col])) $pivot = $row;
        [$matrix[$col], $matrix[$pivot]] = [$matrix[$pivot], $matrix[$col]];
        $divisor = $matrix[$col][$col];
        if (abs($divisor) < 1e-12) return ['weights' => array_fill(0, $size, 0.0), 'scale' => $scale, 'annual' => $annual];
        for ($j = $col; $j <= $size; $j++) $matrix[$col][$j] /= $divisor;
        for ($row = 0; $row < $size; $row++) {
            if ($row === $col) continue;
            $factor = $matrix[$row][$col];
            for ($j = $col; $j <= $size; $j++) $matrix[$row][$j] -= $factor * $matrix[$col][$j];
        }
    }
    return ['weights' => array_column($matrix, $size), 'scale' => $scale, 'annual' => $annual];
}

function forecastPredict(array $history, array $dates, int $horizon, string $model, ?float $capacity = null): array
{
    $count = count($history);
    $values = $history;
    $fit = $model === 'ridge' ? forecastRidge($history, $dates) : null;
    $upper = $capacity ?? max(1.0, max($history) * 2.0);
    for ($index = $count; $index < $count + $horizon; $index++) {
        if ($fit) {
            $x = forecastFeatures($values, $dates, $index, $fit['scale'], $fit['annual']);
            $prediction = array_sum(array_map(static fn($a, $b) => $a * $b, $x, $fit['weights'])) * $fit['scale'];
        } elseif ($model === 'seasonal_naive') {
            $prediction = $values[$index - 7] ?? 0;
        } else {
            $sum = $weights = 0.0;
            // Train weekday means on observations only, not recursive predictions.
            for ($j = $count - 1; $j >= max(0, $count - 84); $j--) {
                if ((new DateTimeImmutable($dates[$j]))->format('N') !== (new DateTimeImmutable($dates[$index]))->format('N')) continue;
                $weight = pow(0.85, ($count - 1 - $j) / 7);
                $sum += $history[$j] * $weight;
                $weights += $weight;
            }
            $prediction = $weights > 0 ? $sum / $weights : 0;
        }
        $values[] = max(0.0, min($upper, is_finite($prediction) ? $prediction : 0));
    }
    return array_slice($values, $count);
}

function forecastQuantile(array $values, float $q): float
{
    if (!$values) return 0;
    sort($values, SORT_NUMERIC);
    return (float) $values[(int) floor((count($values) - 1) * $q)];
}

function forecastSeries(array $history, array $dates, array $onBooks, int $samples, ?float $capacity = null): array
{
    $count = count($history);
    $eligible = $count >= 84 && $samples >= 30;
    $ml = $count >= 182 && $samples >= 60;
    $models = $ml ? ['seasonal_naive','weighted_weekday','ridge'] : ['seasonal_naive','weighted_weekday'];
    $scores = $residuals = [];
    if ($eligible) {
        foreach ($models as $model) {
            $errors = $actuals = [];
            foreach ([90, 60, 30, 14] as $holdout) {
                $cut = $count - $holdout;
                if ($cut < ($model === 'ridge' ? 84 : 56)) continue;
                // The model sees only observations preceding this origin.
                $predicted = forecastPredict(array_slice($history, 0, $cut), $dates, $holdout, $model, $capacity);
                foreach ($predicted as $offset => $value) {
                    $errors[] = $history[$cut + $offset] - $value;
                    $actuals[] = $history[$cut + $offset];
                }
            }
            $absolute = array_sum(array_map('abs', $errors));
            $scores[$model] = ['mae' => round($absolute / max(1, count($errors)), 3),
                'wape' => array_sum($actuals) > 0 ? round(100 * $absolute / array_sum($actuals), 2) : null,
                'validation_points' => count($errors)];
            $residuals[$model] = $errors;
        }
        $selected = 'seasonal_naive';
        foreach ($models as $model) if ($scores[$model]['mae'] < $scores[$selected]['mae'] * 0.98) $selected = $model;
        $predictions = forecastPredict($history, $dates, 90, $selected, $capacity);
    } else { $selected = 'on_books_only'; $predictions = array_fill(0, 90, 0.0); }
    $lowerError = forecastQuantile($residuals[$selected] ?? [], 0.1);
    $upperError = forecastQuantile($residuals[$selected] ?? [], 0.9);
    $points = [];
    foreach ($predictions as $i => $prediction) {
        $floor = (float) ($onBooks[$i] ?? 0);
        $value = max($floor, $prediction);
        $low = max($floor, min($value, $prediction + $lowerError));
        $high = max($value, $prediction + $upperError);
        if ($capacity !== null) $high = max($value, min($capacity, $high));
        $points[] = ['date' => $dates[$count + $i], 'value' => round($value, 2), 'on_books' => $floor,
            'lower' => $eligible ? round($low, 2) : null, 'upper' => $eligible ? round($high, 2) : null];
    }
    return ['model' => $selected, 'eligible' => $eligible, 'ml_eligible' => $ml,
        'confidence' => !$eligible ? 'insufficient_history' : (!$ml ? 'low' : 'historically_validated'),
        'samples' => $samples, 'history_days' => $count, 'training_start' => $dates[0] ?? null,
        'training_end' => $count ? $dates[$count - 1] : null, 'scores' => $scores, 'points' => $points,
        'interval_note' => 'Empirical daily residual band (10th–90th percentiles); coverage is not guaranteed. Weekly bounds sum daily bounds.' ];
}
