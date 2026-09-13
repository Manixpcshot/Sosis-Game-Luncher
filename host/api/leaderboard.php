<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$users = $db['users'];
usort($users, function ($a, $b) {
    $pa = isset($a['totalPlayTime']) ? $a['totalPlayTime'] : 0;
    $pb = isset($b['totalPlayTime']) ? $b['totalPlayTime'] : 0;
    if ($pb === $pa) return 0; return $pb > $pa ? 1 : -1;
});
$users = array_slice($users, 0, 50);
$out = array();
$i = 1;
foreach ($users as $u) {
    $p = sosis_public_user($u);
    $p['rank'] = $i++;
    $out[] = $p;
}
sosis_json_out(array('ok' => true, 'users' => $out));
