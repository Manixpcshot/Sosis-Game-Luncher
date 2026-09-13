<?php
/* Update manifest: GET /latest.json */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = $db['site'];
$file = basename($s['installerFile']);
$path = SOSIS_DOWNLOADS . '/' . $file;
$sha = $s['sha256'];
$size = $s['size'];
if (!file_exists($path)) { $sha = null; $size = 0; }
sosis_json_out(array(
    'app' => (isset($s['siteName']) && $s['siteName'] !== '') ? $s['siteName'] : 'Sosis Launcher',
    'channel' => 'stable',
    'version' => $s['latestVersion'],
    'download' => 'https://app.sosis-shop.top/datasetup/' . $file,
    'sha256' => $sha,
    'size' => $size,
    'notes' => $s['notes'],
    'releasedAt' => $s['releasedAt']
));
