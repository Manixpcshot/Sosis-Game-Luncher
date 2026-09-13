<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
if (empty($_FILES['file'])) sosis_json_out(array('ok' => false, 'error' => 'no-file'), 400);

$f = $_FILES['file'];
if ($f['error'] !== UPLOAD_ERR_OK) sosis_json_out(array('ok' => false, 'error' => 'upload-error-' . $f['error']), 400);
$name = preg_replace('/[^\w.\-]/', '_', basename($f['name']));
if ($name === '' ) sosis_json_out(array('ok' => false, 'error' => 'bad-name'), 400);
$dest = SOSIS_DOWNLOADS . '/' . $name;
if (!move_uploaded_file($f['tmp_name'], $dest)) sosis_json_out(array('ok' => false, 'error' => 'move-failed'), 500);
@chmod($dest, 0644);
sosis_json_out(array('ok' => true, 'name' => $name, 'size' => filesize($dest)));
