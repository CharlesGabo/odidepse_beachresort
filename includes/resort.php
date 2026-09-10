<?php
declare(strict_types=1);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/api.php';

function resortSeed(): array
{
    return json_decode(file_get_contents(__DIR__ . '/resort-seed.json'), true, 64, JSON_THROW_ON_ERROR);
}

function resortSections(): array
{
    $seed = resortSeed();
    $sections = [];
    foreach ($seed['copy'] as $key => $value) $sections['copy.' . $key] = $value;
    foreach (['highlights', 'amenities', 'occasions', 'photos', 'reviews'] as $key) $sections[$key] = $seed[$key];
    return $sections;
}

function resortFields(string $kind): array
{
    $fields = [
        'name' => ['text', 50], 'description' => ['textarea', 2000],
        'price' => ['price'], 'price_mode' => ['select', ['fixed', 'from']], 'price_unit' => ['text', 80],
        'availability' => ['select', ['available', 'unavailable', 'inquiry']], 'availability_text' => ['text', 300],
        'enabled' => ['boolean'], 'archived' => ['boolean'], 'sort_order' => ['number', 0, 10000],
    ];
    if ($kind === 'stays') return $fields + [
        'capacity' => ['text', 30], 'min_guests' => ['number', 1, 100], 'max_guests' => ['number', 1, 100],
        'guests' => ['number', 1, 100], 'room_count' => ['number', 0, 1000],
        'detail' => ['text', 300], 'badge' => ['text', 100], 'style' => ['select', ['standard', 'group', 'exclusive']],
    ];
    $assets = array_column(resortSeed()['photos'], 'id');
    return $fields + ['asset' => ['select', array_merge([''], $assets)],
        'icon' => ['select', ['wave', 'wifi', 'snow', 'paw', 'tv', 'mic', 'kitchen', 'pin']], 'image_caption' => ['text', 150]];
}

function resortInvalid(string $field): never
{
    throw new InvalidArgumentException('Check the value for ' . str_replace('_', ' ', $field) . '.');
}

function resortText(mixed $value, string $field, int $max): string
{
    if (!is_string($value) || mb_strlen($value) > $max || preg_match('/[<>\x00-\x08\x0B\x0C\x0E-\x1F]/u', $value)) resortInvalid($field);
    return $value;
}

function resortValidateEntity(string $kind, mixed $input): array
{
    if (!is_array($input) || array_is_list($input)) resortInvalid('record');
    $fields = resortFields($kind);
    if (array_diff(array_keys($input), array_merge(['id'], array_keys($fields)))) resortInvalid('unknown field');
    $result = [];
    foreach ($fields as $key => $spec) {
        $value = $input[$key] ?? null;
        switch ($spec[0]) {
            case 'text': case 'textarea': $value = resortText($value, $key, $spec[1]); break;
            case 'select': if (!in_array($value, $spec[1], true)) resortInvalid($key); break;
            case 'boolean': if (!is_bool($value)) resortInvalid($key); break;
            case 'number': if (!is_int($value) || $value < $spec[1] || $value > $spec[2]) resortInvalid($key); break;
            case 'price':
                if ($value !== null && (!is_string($value) || !preg_match('/\A\d{1,10}(?:\.\d{1,2})?\z/', $value))) resortInvalid($key);
                break;
        }
        $result[$key] = $value;
    }
    if (trim($result['name']) === '') resortInvalid('name');
    if ($kind === 'stays' && ($result['min_guests'] > $result['max_guests'] || $result['guests'] < $result['min_guests'] || $result['guests'] > $result['max_guests'] || trim($result['capacity']) === '')) resortInvalid('guest limits');
    if ($result['price'] !== null && (float)$result['price'] > 0 && trim($result['price_unit']) === '') resortInvalid('price unit');
    return $result;
}

function resortValidateContent(mixed $value, mixed $template, string $path): mixed
{
    if (is_string($template)) {
        $value = resortText($value, $path, 2000);
        if (str_ends_with($path, '.icon') && !in_array($value, ['wave','wifi','snow','paw','tv','mic','kitchen','pin'], true)) resortInvalid($path);
        if (str_ends_with($path, '.id') && $value !== $template) resortInvalid($path);
        if (str_starts_with($path, 'copy.links.')) {
            if (str_ends_with($path, '.email')) {
                if (!str_starts_with($value, 'mailto:') || !filter_var(substr($value, 7), FILTER_VALIDATE_EMAIL)) resortInvalid($path);
            } else {
                $url = parse_url($value);
                if (!filter_var($value, FILTER_VALIDATE_URL) || ($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass'])) resortInvalid($path);
                if (str_ends_with($path, '.map_embed') && (($url['host'] ?? '') !== 'www.google.com' || !str_starts_with($url['path'] ?? '', '/maps/embed'))) resortInvalid($path);
            }
        }
        return $value;
    }
    if (is_int($template)) { if (!is_int($value) || $value < 1 || $value > 5) resortInvalid($path); return $value; }
    if (!is_array($value)) resortInvalid($path);
    if (array_is_list($template)) {
        if (!array_is_list($value) || count($value) > 100) resortInvalid($path);
        if ($path === 'photos' && count($value) !== count($template)) resortInvalid($path);
        return array_map(fn($item, $i) => resortValidateContent($item, $path === 'photos' ? $template[$i] : $template[0], $path . '.' . $i), $value, array_keys($value));
    }
    if (array_diff(array_keys($value), array_keys($template)) || array_diff(array_keys($template), array_keys($value))) resortInvalid($path);
    foreach ($template as $key => $sample) $value[$key] = resortValidateContent($value[$key], $sample, $path . '.' . $key);
    return $value;
}

function resortEntities(PDO $db, string $kind, bool $admin): array
{
    $table = $kind === 'stays' ? 'resort_stays' : 'resort_services';
    $rows = $db->query('SELECT * FROM ' . $table . ($admin ? '' : ' WHERE enabled = 1 AND archived = 0') . ' ORDER BY sort_order, id')->fetchAll();
    return array_map(function ($row) use ($admin) {
        $details = json_decode($row['details'], true, 32, JSON_THROW_ON_ERROR);
        unset($row['details'], $row['seed_key']);
        $row['id'] = (int)$row['id']; $row['sort_order'] = (int)$row['sort_order'];
        $row['enabled'] = (bool)$row['enabled']; $row['archived'] = (bool)$row['archived'];
        if (!$admin) unset($row['enabled'], $row['archived']);
        return $row + $details;
    }, $rows);
}

function resortSnapshot(PDO $db, bool $admin = false): array
{
    $ownsTransaction = !$db->inTransaction();
    if ($ownsTransaction) $db->beginTransaction();
    try {
        $revision = $db->query('SELECT revision FROM resort_revision WHERE id = 1')->fetchColumn();
        if ($revision === false) throw new RuntimeException('Resort content is not initialized.');
        $sections = [];
        foreach ($db->query('SELECT section_key, content FROM resort_content')->fetchAll() as $row) $sections[$row['section_key']] = json_decode($row['content'], true, 64, JSON_THROW_ON_ERROR);
        if (array_diff_key(resortSections(), $sections)) throw new RuntimeException('Resort content is incomplete.');
        $result = ['revision' => (int)$revision, 'sections' => $sections, 'stays' => resortEntities($db, 'stays', $admin), 'services' => resortEntities($db, 'services', $admin)];
        if ($ownsTransaction) $db->commit();
        return $result;
    } catch (Throwable $error) { if ($ownsTransaction && $db->inTransaction()) $db->rollBack(); throw $error; }
}

function resortSaveEntity(PDO $db, string $kind, array $values, ?int $id): int
{
    $table = $kind === 'stays' ? 'resort_stays' : 'resort_services';
    $columns = ['name','description','price','price_mode','price_unit','availability','availability_text','enabled','archived','sort_order'];
    $details = array_diff_key($values, array_flip($columns));
    $args = array_map(fn($column) => is_bool($values[$column]) ? (int)$values[$column] : $values[$column], $columns);
    $args[] = json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $columns[] = 'details';
    if ($id !== null) {
        $exists = $db->prepare('SELECT id FROM ' . $table . ' WHERE id = ?'); $exists->execute([$id]);
        if (!$exists->fetchColumn()) throw new OutOfBoundsException('Record not found.');
        $args[] = $id;
        $sql = 'UPDATE ' . $table . ' SET ' . implode(', ', array_map(fn($c) => $c . ' = ?', $columns)) . ' WHERE id = ?';
    } else $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')';
    $db->prepare($sql)->execute($args);
    return $id ?? (int)$db->lastInsertId();
}
