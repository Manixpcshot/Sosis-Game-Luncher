<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$user = sosis_current_user();
if (!$user) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);

$in = sosis_input();
$dataUrl = isset($in['dataUrl']) ? (string) $in['dataUrl'] : '';
if (!preg_match('/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/=]+)$/', $dataUrl, $m)) {
    sosis_json_out(array('ok' => false, 'error' => 'bad-image'), 400);
}
$bin = base64_decode($m[2]);
if ($bin === false || strlen($bin) > 2 * 1024 * 1024) sosis_json_out(array('ok' => false, 'error' => 'too-large'), 413);

$ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
$name = $user['id'] . '.' . $ext;
@file_put_contents(SOSIS_AVATARS . '/' . $name, $bin, LOCK_EX);

$db = sosis_db_load();
foreach ($db['users'] as &$u) {
    if ($u['id'] === $user['id']) { $u['avatar'] = $name; break; }
}
unset($u);
sosis_db_save($db);
$user['avatar'] = $name;
sosis_json_out(array('ok' => true, 'user' => sosis_public_user($user)));
