<?php
/* Admin store games:
   GET    /api/admin/games          -> list all (incl. unpublished)
   POST   /api/admin/games          -> create/update game (JSON meta + image dataUrls)
   DELETE /api/admin/games/<id>     -> delete game + its files/images
   (file upload is separate: /api/admin/games/upload) */
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
$db = sosis_db_load();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    sosis_json_out(array('ok' => true, 'games' => $db['store']['games']));
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
    $found = false;
    $out = array();
    foreach ($db['store']['games'] as $g) {
        if ($g['id'] === $id) { $found = true; continue; }
        $out[] = $g;
    }
    if (!$found) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);
    $db['store']['games'] = $out;
    sosis_db_save($db);
    /* remove game data dir + store images */
    $dir = SOSIS_GAMEDATA . '/' . preg_replace('/[^A-Za-z0-9_-]/', '', $id);
    if (is_dir($dir)) {
        foreach (glob($dir . '/*') as $f) @unlink($f);
        @rmdir($dir);
    }
    foreach (glob(SOSIS_STOREIMG . '/' . preg_replace('/[^A-Za-z0-9_-]/', '', $id) . '-*') as $f) @unlink($f);
    sosis_json_out(array('ok' => true));
}

if ($method !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$in = sosis_input();
$id = isset($in['id']) && $in['id'] ? (string) $in['id'] : '';
$name = isset($in['name']) ? trim((string) $in['name']) : '';
if ($name === '') sosis_json_out(array('ok' => false, 'error' => 'name-required'), 400);
$kind = (isset($in['kind']) && $in['kind'] === 'link') ? 'link' : 'upload';
$linkUrl = isset($in['linkUrl']) ? trim((string) $in['linkUrl']) : '';
if ($kind === 'link' && !preg_match('/^https?:\/\/.+/i', $linkUrl)) {
    sosis_json_out(array('ok' => false, 'error' => 'bad-link'), 400);
}
$price = isset($in['price']) ? max(0, (int) $in['price']) : 0;
$description = isset($in['description']) ? (string) $in['description'] : '';
if (function_exists('mb_substr')) $description = mb_substr($description, 0, 20000, 'UTF-8');

$isNew = ($id === '');
if ($isNew) $id = sosis_new_id('g');

$idx = -1;
foreach ($db['store']['games'] as $i => $g) { if ($g['id'] === $id) { $idx = $i; break; } }
if (!$isNew && $idx < 0) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);

$game = $idx >= 0 ? $db['store']['games'][$idx] : array(
    'id' => $id, 'size' => 0, 'sha256' => null, 'file' => null,
    'downloads' => 0, 'createdAt' => time() * 1000
);
$game['name'] = $name;
$game['description'] = $description;
$game['price'] = $price;
$game['kind'] = $kind;
$game['linkUrl'] = $linkUrl;
$game['published'] = array_key_exists('published', $in) ? (bool) $in['published'] : (isset($game['published']) ? $game['published'] : true);

/* images (data URLs) — cover / banner / hover */
foreach (array('cover' => 'coverDataUrl', 'banner' => 'bannerDataUrl', 'hoverImage' => 'hoverDataUrl') as $field => $key) {
    if (isset($in[$key]) && $in[$key]) {
        $saved = sosis_save_image_data_url($in[$key], SOSIS_STOREIMG, $id . '-' . $field);
        if ($saved) $game[$field] = $saved;
    }
}

if ($idx >= 0) $db['store']['games'][$idx] = $game;
else $db['store']['games'][] = $game;
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'game' => $game));
