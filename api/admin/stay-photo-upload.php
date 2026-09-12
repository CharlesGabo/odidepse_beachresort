<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/stay-photos.php';
requireMethod('POST');
requireAdmin();
requireCsrfToken();
try {
    $attempts = array_filter($_SESSION['photo_uploads'] ?? [], static fn($time) => $time > time() - 600);
    if (count($attempts) >= 30) jsonResponse(['message' => 'Please wait before uploading more photos.'], 429);
    $attempts[] = time();
    $_SESSION['photo_uploads'] = $attempts;
    $file = $_FILES['photo'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null)
        || !is_uploaded_file($file['tmp_name']) || $file['size'] > 2097152 || $file['size'] < 1) {
        jsonResponse(['message' => 'Choose a photo smaller than 2 MB after compression.'], 422);
    }
    $info = @getimagesize($file['tmp_name']);
    if (!$info || $info[2] !== IMAGETYPE_JPEG || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== 'image/jpeg'
        || $info[0] > 1920 || $info[1] > 1920 || $info[0] < 1 || $info[1] < 1) {
        jsonResponse(['message' => 'The photo must be a valid JPEG up to 1920 pixels.'], 422);
    }
    $id = bin2hex(random_bytes(16)) . '.jpg';
    $path = stayPhotoPath($id);
    if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0750, true)) throw new RuntimeException('Storage unavailable.');
    if (!move_uploaded_file($file['tmp_name'], $path)) throw new RuntimeException('Upload failed.');
    jsonResponse(['status' => 'success', 'id' => $id], 201);
} catch (Throwable $error) {
    error_log('Stay photo upload failed: ' . $error->getMessage());
    jsonResponse(['message' => 'Could not upload this photo. Please try again.'], 503);
}
