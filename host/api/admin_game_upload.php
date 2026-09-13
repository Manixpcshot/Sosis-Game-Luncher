<?php
/* Admin: direct game file upload (multipart, up to ~2GB per host limits)
   POST /api/admin/games/upload  fields: gameId + file */
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$gameId = isset($_POST['gameId']) ? (string) $_POST['gameId'] : '';
if (!preg_match('/^[A-Za-z0-9_-]+$/', $gameId)) sosis_json_out(array('ok' => false, 'error' => 'bad-id'), 400);
if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $code = isset($_FILES['file']) ? (int) $_FILES['file']['error'] : -1;
    $err = 'upload-failed';
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) $err = 'too-large';
    sosis_json_out(array('ok' => false, 'error' => $err, 'code' => $code), 400);
}

$db = sosis_db_load();
$idx = -1;
foreach ($db['store']['games'] as $i => $g) { if ($g['id'] === $gameId) { $idx = $i; break; } }
if ($idx < 0) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);

$dir = SOSIS_GAMEDATA . '/' . $gameId;
if (!is_dir($dir)) @mkdir($dir, 0755, true);

/* sanitize name, keep extension */
$orig = isset($_FILES['file']['name']) ? (string) $_FILES['file']['name'] : 'game.bin';
$orig = str_replace(array('\\', '/'), '-', $orig);
$ext = pathinfo($orig, PATHINFO_EXTENSION);
$base = pathinfo($orig, PATHINFO_FILENAME);
$base = preg_replace('/[^A-Za-z0-9._ -]/', '', $base);
if ($base === '') $base = 'game';
$name = $ext !== '' ? $base . '.' . substr(preg_replace('/[^A-Za-z0-9]/', '', $ext), 0, 8) : $base;

$dest = $dir . '/' . $name;
if (!@move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
    sosis_json_out(array('ok' => false, 'error' => 'move-failed'), 500);
}

/* replace old file if different */
$old = isset($db['store']['games'][$idx]['file']) ? $db['store']['games'][$idx]['file'] : '';
if ($old !== '' && $old !== $name && file_exists($dir . '/' . basename($old))) @unlink($dir . '/' . basename($old));

$g = &$db['store']['games'][$idx];
$g['kind'] = 'upload';
$g['file'] = $name;
$g['size'] = filesize($dest);
$g['sha256'] = hash_file('sha256', $dest);
unset($g);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'game' => $db['store']['games'][$idx]));
