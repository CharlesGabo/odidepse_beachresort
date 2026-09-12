<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/auth.php';
require_once dirname(__DIR__) . '/includes/database.php';
require_once dirname(__DIR__) . '/includes/stay-photos.php';
requireMethod('GET');
try {
    $id = $_GET['id'] ?? '';
    if (!is_string($id)) throw new InvalidArgumentException();
    $path = stayPhotoPath($id);
    if (!is_file($path)) throw new InvalidArgumentException();
    $statement = database()->prepare("SELECT id FROM resort_stays WHERE enabled = 1 AND archived = 0 AND JSON_CONTAINS(details, JSON_QUOTE(?), '$.photos') LIMIT 1");
    $statement->execute([$id]);
    if (!$statement->fetchColumn()) requireAdmin();
    header('Content-Type: image/jpeg');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    header('Content-Length: ' . filesize($path));
    readfile($path);
} catch (InvalidArgumentException) {
    jsonResponse(['message' => 'Photo not found.'], 404);
} catch (Throwable $error) {
    error_log('Stay photo read failed: ' . $error->getMessage());
    jsonResponse(['message' => 'Photo unavailable.'], 503);
}
