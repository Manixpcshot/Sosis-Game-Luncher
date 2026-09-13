<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
if (array_key_exists('downloadEnabled', $in)) $db['site']['downloadEnabled'] = (bool) $in['downloadEnabled'];
if (array_key_exists('notes', $in)) $db['site']['notes'] = (string) $in['notes'];
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'site' => $db['site']));
