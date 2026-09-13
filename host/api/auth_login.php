<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
$username = trim(isset($in['username']) ? (string) $in['username'] : '');
$password = isset($in['password']) ? (string) $in['password'] : '';

$user = null;
foreach ($db['users'] as $u) {
    if (strcasecmp($u['username'], $username) === 0) { $user = $u; break; }
}
if (!$user || !password_verify($password, $user['hash'])) {
    sosis_json_out(array('ok' => false, 'error' => 'invalid-credentials'), 401);
}
$token = sosis_make_token($user['id']);
sosis_set_cookie('sosis_token', $token, 30);
sosis_json_out(array('ok' => true, 'token' => $token, 'user' => sosis_public_user($user)));
