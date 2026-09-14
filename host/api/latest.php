<?php
/* Update manifest: GET /latest.json
   Distribution model (v1.2.3+): the update/download artifact is the TINY web
   installer (SosisLauncherWebSetup.exe, ~320 KB); it fetches the big payload
   from the same endpoint at install time. The legacy full offline setup is
   only used as a fallback when the web setup is missing. */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = $db['site'];

$web = SOSIS_DOWNLOADS . '/SosisLauncherWebSetup.exe';
if (is_file($web)) {
    $file = 'SosisLauncherWebSetup.exe';
    $sha = hash_file('sha256', $web);
    $size = filesize($web);
} else {
    $file = basename($s['installerFile']);
    $path = SOSIS_DOWNLOADS . '/' . $file;
    $sha = $s['sha256'];
    $size = $s['size'];
    if (!file_exists($path)) { $sha = null; $size = 0; }
}
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
