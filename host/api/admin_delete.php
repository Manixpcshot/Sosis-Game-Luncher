<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$name = basename(isset($_GET['file']) ? (string) $_GET['file'] : '');
if ($name === $db['site']['installerFile']) {
    /* Deleting the published installer: only allowed when the tiny web
       installer is present - publish switches to it automatically so the
       site/update pipeline never points at a missing file. */
    $web = SOSIS_DOWNLOADS . '/SosisLauncherWebSetup.exe';
    if (!is_file($web)) sosis_json_out(array('ok' => false, 'error' => 'in-use'), 409);
    $s = &$db['site'];
    $s['installerFile'] = 'SosisLauncherWebSetup.exe';
    $s['sha256'] = hash_file('sha256', $web);
    $s['size'] = filesize($web);
    unset($s);
    sosis_db_save($db);
}
$path = SOSIS_DOWNLOADS . '/' . $name;
if (is_file($path)) @unlink($path);
sosis_json_out(array('ok' => true));
