<?php
declare(strict_types=1);

function stayPhotoPath(string $id): string
{
    if (!preg_match('/\A[a-f0-9]{32}\.jpg\z/', $id)) throw new InvalidArgumentException('Invalid photo.');
    return __DIR__ . '/stay-photo-storage/' . $id;
}

function validateStayPhotos(mixed $photos): array
{
    if (!is_array($photos) || !array_is_list($photos) || count($photos) > 12) throw new InvalidArgumentException('Choose up to 12 photos.');
    foreach ($photos as $id) {
        if (!is_string($id)) throw new InvalidArgumentException('Invalid photo.');
        if (preg_match('/\Aroom_[0-9]\z/', $id)) continue;
        if (!is_file(stayPhotoPath($id))) throw new InvalidArgumentException('A photo is unavailable. Upload it again.');
    }
    return array_values(array_unique($photos));
}
