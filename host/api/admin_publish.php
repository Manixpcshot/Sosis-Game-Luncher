<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
$version = trim(isset($in['version']) ? (string) $in['version'] : '');
$file = basename(isset($in['file']) ? (string) $in['file'] : '');
$notes = isset($in['notes']) ? (string) $in['notes'] : '';
if (!preg_match('/^\d+\.\d+\.\d+$/', $version)) sosis_json_out(array('ok' => false, 'error' => 'bad-version'), 400);
$path = SOSIS_DOWNLOADS . '/' . $file;
if (!is_file($path)) sosis_json_out(array('ok' => false, 'error' => 'file-missing'), 404);

$s = &$db['site'];
$s['latestVersion'] = $version;
$s['installerFile'] = $file;
$s['notes'] = $notes;
$s['sha256'] = hash_file('sha256', $path);
$s['size'] = filesize($path);
$s['releasedAt'] = gmdate('c');
$s['downloadEnabled'] = true;
unset($s);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'site' => $db['site']));
