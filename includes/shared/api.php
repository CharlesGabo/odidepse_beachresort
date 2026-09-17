<?php

declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function requireMethod(string ...$methods): string
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        jsonResponse(['status' => 'error', 'message' => 'Method not allowed.'], 405);
    }

    return $method;
}

function readJsonBody(int $maximumBytes = 16384): array
{
    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        jsonResponse(['status' => 'error', 'message' => 'Content-Type must be application/json.'], 415);
    }

    $raw = file_get_contents('php://input', false, null, 0, $maximumBytes + 1);
    if ($raw === false || strlen($raw) > $maximumBytes) {
        jsonResponse(['status' => 'error', 'message' => 'The request body is too large.'], 413);
    }

    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        jsonResponse(['status' => 'error', 'message' => 'The request contains invalid JSON.'], 400);
    }

    if (!is_array($data)) {
        jsonResponse(['status' => 'error', 'message' => 'A JSON object is required.'], 400);
    }

    return $data;
}

function clientIdentifier(string $scope, string $extra = ''): string
{
    $address = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $scope . '|' . $address . '|' . strtolower($extra));
}

function cleanText(mixed $value, int $maximumLength): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    return mb_substr($value, 0, $maximumLength);
}
