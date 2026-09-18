<?php
declare(strict_types=1);

function stayPhotoPath(string $id): string
{
    if (!preg_match('/\A[a-f0-9]{32}\.jpg\z/', $id)) throw new InvalidArgumentException('Invalid photo.');
    return dirname(__DIR__) . '/stay-photo-storage/' . $id;
}

function stayPhotoDeliveryPath(string $id): string
{
    $bundled = [
        'room_0' => '657400922_122094804950888235_2931481430991994197_n.jpg',
        'room_1' => '654957003_122094807332888235_4815208533666220261_n.jpg',
        'room_2' => '654986087_122094804962888235_9005537267635969399_n.jpg',
        'room_3' => '656030420_122094807314888235_4840499181606827926_n.jpg',
        'room_4' => '657397351_122094807302888235_272301220248350936_n.jpg',
        'room_5' => '750903917_122120192198888235_2640995632591519461_n.jpg',
        'room_6' => '655833692_122094807344888235_2468592255285064955_n.jpg',
        'room_7' => '656205069_122094807260888235_3854624150676995534_n.jpg',
        'room_8' => '656309771_122094807284888235_318662018186262090_n.jpg',
        'room_9' => '657125929_122094807362888235_4455804092410022346_n.jpg',
    ];
    $path = isset($bundled[$id])
        ? dirname(__DIR__, 2) . '/src/assets/photos/rooms/' . $bundled[$id]
        : stayPhotoPath($id);
    if (!is_file($path)) throw new InvalidArgumentException('Photo unavailable.');
    return $path;
}

function validateStayPhotos(mixed $photos): array
{
    if (!is_array($photos) || !array_is_list($photos) || count($photos) > 12) throw new InvalidArgumentException('Choose up to 12 photos.');
    foreach ($photos as $id) {
        if (!is_string($id)) throw new InvalidArgumentException('Invalid photo.');
        if (preg_match('/\A(?:room_[0-9]|guest_(?:[0-9]|10))\z/', $id)) continue;
        if (!is_file(stayPhotoPath($id))) throw new InvalidArgumentException('A photo is unavailable. Upload it again.');
    }
    return array_values(array_unique($photos));
}
