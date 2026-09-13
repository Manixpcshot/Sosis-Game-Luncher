<?php
/* Gated file download: GET /datasetup/<file> */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
if (!$db['site']['downloadEnabled']) {
    sosis_json_out(array('ok' => false, 'error' => 'downloads-disabled'), 403);
}
$name = basename(isset($_GET['file']) ? (string) $_GET['file'] : '');
if ($name === '' || $name === '.' || $name === '..') sosis_json_out(array('ok' => false, 'error' => 'bad-name'), 400);
$path = SOSIS_DOWNLOADS . '/' . $name;
if (!is_file($path)) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: no-store');
readfile($path);
exit;
