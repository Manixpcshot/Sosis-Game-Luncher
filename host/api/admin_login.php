<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
$password = isset($in['password']) ? (string) $in['password'] : '';
if (!password_verify($password, $db['admin']['hash'])) {
    sosis_json_out(array('ok' => false, 'error' => 'invalid-password'), 401);
}
sosis_set_cookie('sosis_admin', sosis_make_token('admin', 'admin'), 0.5, 'Strict');
sosis_json_out(array('ok' => true));
