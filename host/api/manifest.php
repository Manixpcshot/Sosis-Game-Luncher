<?php
/* Launcher Download Endpoint manifest: GET /datasetup */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = &$db['site'];
$file = $s['installerFile'];
$path = SOSIS_DOWNLOADS . '/' . basename($file);
$sha = $s['sha256'];
$size = $s['size'];
if (!file_exists($path)) {
    $sha = null;
    $size = 0;
} elseif (!$sha) {
    $sha = hash_file('sha256', $path);
    $size = filesize($path);
    $s['sha256'] = $sha;
    $s['size'] = $size;
    sosis_db_save($db);
}
unset($s);
sosis_json_out(array(
    'name' => 'Sosis Launcher',
    'version' => $s['latestVersion'],
    'baseUrl' => 'https://app.sosis-shop.top/datasetup',
    'notes' => $s['notes'],
    'downloadEnabled' => (bool) $s['downloadEnabled'],
    'releasedAt' => $s['releasedAt'],
    'files' => array(array(
        'name' => basename($file),
        'url' => 'https://app.sosis-shop.top/datasetup/' . basename($file),
        'sha256' => $sha,
        'size' => $size,
        'kind' => 'installer',
        'run' => array('silent' => array('/S'), 'after' => 'launch')
    ))
));
