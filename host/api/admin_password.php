<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
$current = isset($in['current']) ? (string) $in['current'] : '';
$next = isset($in['next']) ? (string) $in['next'] : '';
if (!password_verify($current, $db['admin']['hash'])) sosis_json_out(array('ok' => false, 'error' => 'invalid-password'), 401);
if (strlen($next) < 8) sosis_json_out(array('ok' => false, 'error' => 'weak-password'), 400);
$db['admin'] = array('hash' => password_hash($next, PASSWORD_DEFAULT), 'changed' => true);
sosis_db_save($db);
sosis_json_out(array('ok' => true));
