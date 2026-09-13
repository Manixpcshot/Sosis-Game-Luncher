<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
$db = sosis_db_load();
$files = array();
foreach (glob(SOSIS_DOWNLOADS . '/*') as $f) {
    if (!is_file($f)) continue;
    $files[] = array('name' => basename($f), 'size' => filesize($f), 'mtime' => filemtime($f) * 1000);
}
usort($files, function ($a, $b) { if ($b['mtime'] === $a['mtime']) return 0; return $b['mtime'] > $a['mtime'] ? 1 : -1; });
$users = array();
foreach ($db['users'] as $u) $users[] = sosis_public_user($u);
sosis_json_out(array(
    'ok' => true,
    'site' => $db['site'],
    'files' => $files,
    'users' => $users,
    'stats' => array(
        'users' => count($db['users']),
        'sessions' => count($db['sessions']),
        'games' => count($db['games'])
    )
));
