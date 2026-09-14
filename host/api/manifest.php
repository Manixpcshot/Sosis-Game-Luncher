<?php
/* Launcher Download Endpoint manifest: GET /datasetup */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = &$db['site'];
$file = basename($s['installerFile']);
$path = SOSIS_DOWNLOADS . '/' . $file;
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
$appName = (isset($s['siteName']) && $s['siteName'] !== '') ? $s['siteName'] : 'Sosis Launcher';
$files = array(array(
    'name' => $file,
    'url' => 'https://app.sosis-shop.top/datasetup/' . $file,
    'sha256' => $sha,
    'size' => $size,
    'kind' => 'installer',
    'run' => array('silent' => array('/S'), 'after' => 'launch')
));

/* Companion artifacts for the tiny web installer: the bootstrapper EXE and
   the compressed app payload it downloads. Hashes are cached in the db and
   only recomputed when size/mtime change (payload can be >100 MB). */
if (!isset($db['fileMeta']) || !is_array($db['fileMeta'])) $db['fileMeta'] = array();
$companions = array(
    'SosisLauncherWebSetup.exe' => 'web-installer',
    'sosis-payload.zip' => 'payload',
    'sosis-payload.sha256' => 'payload-hash'
);
foreach ($companions as $cname => $ckind) {
    $cpath = SOSIS_DOWNLOADS . '/' . $cname;
    if (!is_file($cpath)) continue;
    $csize = filesize($cpath);
    $cmtime = filemtime($cpath);
    $meta = isset($db['fileMeta'][$cname]) ? $db['fileMeta'][$cname] : null;
    if (!is_array($meta) || !isset($meta['size']) || !isset($meta['mtime'])
        || (int) $meta['size'] !== (int) $csize || (int) $meta['mtime'] !== (int) $cmtime
        || empty($meta['sha256'])) {
        $meta = array('size' => $csize, 'mtime' => $cmtime, 'sha256' => hash_file('sha256', $cpath));
        $db['fileMeta'][$cname] = $meta;
        sosis_db_save($db);
    }
    $entry = array(
        'name' => $cname,
        'url' => 'https://app.sosis-shop.top/datasetup/' . $cname,
        'size' => (int) $meta['size'],
        'kind' => $ckind
    );
    if ($ckind !== 'payload-hash') $entry['sha256'] = $meta['sha256'];
    $files[] = $entry;
}

$out = array(
    'name' => $appName,
    'version' => $s['latestVersion'],
    'baseUrl' => 'https://app.sosis-shop.top/datasetup',
    'notes' => $s['notes'],
    'downloadEnabled' => (bool) $s['downloadEnabled'],
    'releasedAt' => $s['releasedAt'],
    'files' => $files
);
unset($s);
sosis_json_out($out);
