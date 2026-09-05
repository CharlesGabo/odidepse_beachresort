<?php

declare(strict_types=1);

// One fixed resort location; callers cannot choose an upstream URL or filesystem path.
function resortForecast(): array
{
    $path = sys_get_temp_dir() . '/odidepse-weather-' . hash('sha256', __DIR__) . '.json';
    $file = fopen($path, 'c+');
    if ($file === false || !flock($file, LOCK_EX)) {
        throw new RuntimeException('Weather cache unavailable.');
    }
    try {
        $cache = json_decode(stream_get_contents($file) ?: '{}', true) ?: [];
        if (($cache['expires'] ?? 0) > time()) {
            if (isset($cache['source'])) return summarizeForecast($cache['source']);
            throw new RuntimeException('Weather temporarily unavailable.');
        }
        $headers = [];
        $curl = curl_init('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=15.0578&lon=120.0567');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => 'OdidepseBeachResort/1.0',
            CURLOPT_HTTPHEADER => isset($cache['modified']) ? ['If-Modified-Since: ' . $cache['modified']] : [],
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$headers): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                return strlen($line);
            },
        ]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        $next = ['expires' => max(time() + 600, strtotime($headers['expires'] ?? '') ?: 0)];
        if ($status === 304 && isset($cache['source'])) {
            $next += ['source' => $cache['source'], 'modified' => $cache['modified']];
        } elseif ($status === 200 && is_string($body)) {
            $source = json_decode($body, true);
            if (is_array($source) && isset($source['properties']['timeseries'])) {
                try {
                    summarizeForecast($source);
                    $next['source'] = $source;
                    if (isset($headers['last-modified'])) $next['modified'] = $headers['last-modified'];
                } catch (Throwable) {
                    // Treat incomplete upstream data like an outage and apply the backoff below.
                }
            }
        }
        // Back off during upstream failures; do not present an old forecast as live.
        if (!isset($next['source'])) $next = ['expires' => time() + 60];
        rewind($file);
        ftruncate($file, 0);
        fwrite($file, json_encode($next, JSON_THROW_ON_ERROR));
        fflush($file);
        if (!isset($next['source'])) throw new RuntimeException('Weather temporarily unavailable.');
        return summarizeForecast($next['source']);
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

function summarizeForecast(array $source): array
{
    $zone = new DateTimeZone('Asia/Manila');
    $today = new DateTimeImmutable('today', $zone);
    $days = [];
    for ($i = 0; $i < 7; $i++) {
        $date = $today->modify("+$i days")->format('Y-m-d');
        $days[$date] = ['date' => $date, 'low' => null, 'high' => null, 'rain' => 0, 'wind' => 0, 'symbol' => null, 'distance' => 25];
    }
    $nearest = null;
    $nearestDistance = PHP_INT_MAX;
    $rainEnd = 0;
    foreach ($source['properties']['timeseries'] as $entry) {
        $time = new DateTimeImmutable($entry['time']);
        $local = $time->setTimezone($zone);
        $date = $local->format('Y-m-d');
        $details = $entry['data']['instant']['details'];
        if (!is_numeric($details['air_temperature'] ?? null) || !is_numeric($details['wind_speed'] ?? null)) continue;
        $period = $entry['data']['next_1_hours'] ?? $entry['data']['next_6_hours'] ?? null;
        $symbol = $period['summary']['symbol_code'] ?? $entry['data']['next_12_hours']['summary']['symbol_code'] ?? 'cloudy';
        $distance = abs($time->getTimestamp() - time());
        if ($distance < $nearestDistance) {
            $nearestDistance = $distance;
            $nearest = ['time' => $entry['time'], 'temperature' => $details['air_temperature'], 'humidity' => $details['relative_humidity'] ?? null, 'wind' => round($details['wind_speed'] * 3.6, 1), 'symbol' => $symbol];
        }
        if (!isset($days[$date])) continue;
        $day = &$days[$date];
        $temp = $details['air_temperature'];
        $day['low'] = $day['low'] === null ? $temp : min($day['low'], $temp);
        $day['high'] = $day['high'] === null ? $temp : max($day['high'], $temp);
        $day['wind'] = max($day['wind'], round($details['wind_speed'] * 3.6, 1));
        if ($period !== null && $time->getTimestamp() >= $rainEnd) {
            $day['rain'] += $period['details']['precipitation_amount'] ?? 0;
            $rainEnd = $time->getTimestamp() + (isset($entry['data']['next_1_hours']) ? 3600 : 21600);
        }
        $noonDistance = abs((int) $local->format('G') - 12);
        if ($noonDistance < $day['distance']) {
            $day['symbol'] = $symbol;
            $day['distance'] = $noonDistance;
        }
        unset($day);
    }
    foreach ($days as &$day) {
        if ($day['low'] === null || $day['symbol'] === null) throw new RuntimeException('Incomplete forecast.');
        $day['rain'] = round($day['rain'], 1);
        unset($day['distance']);
    }
    if ($nearest === null || $nearestDistance > 10800) throw new RuntimeException('Forecast is out of date.');
    return ['updatedAt' => $source['properties']['meta']['updated_at'], 'current' => $nearest, 'days' => array_values($days)];
}
