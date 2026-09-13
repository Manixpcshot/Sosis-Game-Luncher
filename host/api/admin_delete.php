<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$name = basename(isset($_GET['file']) ? (string) $_GET['file'] : '');
if ($name === $db['site']['installerFile']) sosis_json_out(array('ok' => false, 'error' => 'in-use'), 409);
$path = SOSIS_DOWNLOADS . '/' . $name;
if (is_file($path)) @unlink($path);
sosis_json_out(array('ok' => true));
