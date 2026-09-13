<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$user = sosis_current_user();
if (!$user) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);

$in = sosis_input();
$seconds = isset($in['seconds']) ? (int) $in['seconds'] : 0;
$seconds = max(0, min(24 * 3600, $seconds));
$name = mb_substr(isset($in['gameName']) ? (string) $in['gameName'] : 'Unknown', 0, 80);

$db = sosis_db_load();
foreach ($db['users'] as &$u) {
    if ($u['id'] === $user['id']) {
        $u['totalPlayTime'] = (isset($u['totalPlayTime']) ? $u['totalPlayTime'] : 0) + $seconds;
        $u['totalSessions'] = (isset($u['totalSessions']) ? $u['totalSessions'] : 0) + 1;
        $u['launchCount'] = (isset($u['launchCount']) ? $u['launchCount'] : 0) + 1;
        $user = $u;
        break;
    }
}
unset($u);

if (!isset($db['games'][$name])) {
    $db['games'][$name] = array('name' => $name, 'launches' => 0, 'playTime' => 0, 'players' => array());
}
$g = &$db['games'][$name];
$g['launches'] += 1;
$g['playTime'] += $seconds;
$pid = $user['id'];
$g['players'][$pid] = (isset($g['players'][$pid]) ? $g['players'][$pid] : 0) + $seconds;
unset($g);

$db['sessions'][] = array(
    'userId' => $user['id'],
    'game' => $name,
    'seconds' => $seconds,
    'endedAt' => isset($in['endedAt']) ? (int) $in['endedAt'] : (int) (microtime(true) * 1000)
);
if (count($db['sessions']) > 5000) $db['sessions'] = array_slice($db['sessions'], -5000);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'user' => sosis_public_user($user)));
