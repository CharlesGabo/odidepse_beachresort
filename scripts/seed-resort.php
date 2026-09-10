<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/includes/resort.php';
try {
    $db = database();
    $catalog = json_decode(file_get_contents(dirname(__DIR__) . '/database/migrations/003_resort_catalog.json'), true, 64, JSON_THROW_ON_ERROR);
    $db->beginTransaction();
    $db->query('SELECT revision FROM resort_revision WHERE id = 1 FOR UPDATE')->fetchColumn();
    $insert = $db->prepare('INSERT IGNORE INTO resort_content (section_key,content) VALUES (?,?)');
    $changed = false;
    foreach (resortSections() as $key => $value) {
        $insert->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        $changed = $insert->rowCount() > 0 || $changed;
    }
    foreach ($catalog as $kind => $records) {
        $table = $kind === 'stays' ? 'resort_stays' : 'resort_services';
        foreach ($records as $index => $record) {
            $key = $kind . '-' . $index;
            $find = $db->prepare('SELECT id FROM ' . $table . ' WHERE seed_key = ?'); $find->execute([$key]);
            if ($find->fetchColumn()) continue;
            $id = resortSaveEntity($db, $kind, resortValidateEntity($kind, $record), null);
            $changed = true;
            $db->prepare('UPDATE ' . $table . ' SET seed_key = ? WHERE id = ?')->execute([$key, $id]);
        }
    }
    if ($changed) $db->exec('UPDATE resort_revision SET revision = revision + 1 WHERE id = 1');
    $db->commit();
    echo "Resort seed complete. Existing managed values were preserved.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, "Resort seed failed: " . $error->getMessage() . "\n"); exit(1);
}
