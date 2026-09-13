<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
$username = trim(isset($in['username']) ? (string) $in['username'] : '');
$password = isset($in['password']) ? (string) $in['password'] : '';
$email = trim(isset($in['email']) ? (string) $in['email'] : '');

if (!preg_match('/^[\w\-]{3,24}$/u', $username)) sosis_json_out(array('ok' => false, 'error' => 'bad-username'), 400);
if (strlen($password) < 6) sosis_json_out(array('ok' => false, 'error' => 'weak-password'), 400);
foreach ($db['users'] as $u) {
    if (strcasecmp($u['username'], $username) === 0) sosis_json_out(array('ok' => false, 'error' => 'username-taken'), 409);
}

$user = array(
    'id' => sosis_random_id(),
    'username' => $username,
    'email' => $email !== '' ? $email : null,
    'hash' => password_hash($password, PASSWORD_DEFAULT),
    'avatar' => null,
    'totalPlayTime' => 0,
    'totalSessions' => 0,
    'launchCount' => 0,
    'createdAt' => (int) (microtime(true) * 1000)
);
$db['users'][] = $user;
sosis_db_save($db);
$token = sosis_make_token($user['id']);
sosis_set_cookie('sosis_token', $token, 30);
sosis_json_out(array('ok' => true, 'token' => $token, 'user' => sosis_public_user($user)));
