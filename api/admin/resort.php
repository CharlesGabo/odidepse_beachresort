<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/auth.php';
require_once dirname(__DIR__, 2) . '/includes/resort.php';
$method = requireMethod('GET', 'POST', 'PATCH');
requireAdmin();
try {
    $db = database();
    if ($method === 'GET') jsonResponse(['status' => 'success', 'fields' => ['stays' => resortFields('stays'), 'services' => resortFields('services')], 'templates' => resortSections()] + resortSnapshot($db, true));
    requireCsrfToken();
    $data = readJsonBody(262144);
    if (!is_int($data['revision'] ?? null) || !in_array($data['kind'] ?? null, ['content','stays','services'], true)) resortInvalid('request');
    $kind = $data['kind'];
    if ($kind === 'content') {
        if ($method !== 'PATCH') resortInvalid('method');
        $section = $data['section'] ?? '';
        $templates = resortSections();
        if (!is_string($section) || !array_key_exists($section, $templates)) resortInvalid('section');
        $values = resortValidateContent($data['value'] ?? null, $templates[$section], $section);
    } else {
        $id = $method === 'PATCH' ? ($data['id'] ?? null) : null;
        if ($method === 'PATCH' && (!is_int($id) || $id < 1)) resortInvalid('id');
        $values = resortValidateEntity($kind, $data['value'] ?? null);
    }
    $db->beginTransaction();
    $revision = (int)$db->query('SELECT revision FROM resort_revision WHERE id = 1 FOR UPDATE')->fetchColumn();
    if ($revision !== $data['revision']) { $db->rollBack(); jsonResponse(['status' => 'error', 'message' => 'Someone saved changes since you opened this editor. Reload the latest data before saving again.'], 409); }
    if ($kind === 'content') $db->prepare('UPDATE resort_content SET content = ? WHERE section_key = ?')->execute([json_encode($values, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $section]);
    else $id = resortSaveEntity($db, $kind, $values, $id);
    $db->exec('UPDATE resort_revision SET revision = revision + 1 WHERE id = 1');
    $db->commit();
    jsonResponse(['status' => 'success', 'revision' => $revision + 1, 'id' => $id ?? null]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if ($error instanceof InvalidArgumentException) jsonResponse(['status' => 'error', 'message' => $error->getMessage()], 422);
    if ($error instanceof OutOfBoundsException) jsonResponse(['status' => 'error', 'message' => 'Record not found.'], 404);
    error_log('Resort content save failed: ' . $error->getMessage());
    jsonResponse(['status' => 'error', 'message' => 'Resort information could not be saved. Please try again.'], 503);
}
