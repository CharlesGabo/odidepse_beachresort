<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/api.php';
require_once __DIR__ . '/../includes/weather.php';

requireMethod('GET');
try {
    jsonResponse(['status' => 'ok', 'forecast' => resortForecast()]);
} catch (Throwable $error) {
    error_log('Resort weather retrieval failed: ' . get_class($error));
    jsonResponse(['status' => 'error', 'message' => 'Weather is temporarily unavailable. Please try again shortly.'], 503);
}
