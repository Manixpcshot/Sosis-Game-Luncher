<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$games = array();
foreach ($db['games'] as $g) {
    $games[] = array(
        'name' => $g['name'],
        'launches' => $g['launches'],
        'playTime' => $g['playTime'],
        'players' => count($g['players'])
    );
}
usort($games, function ($a, $b) { if ($b['launches'] === $a['launches']) return 0; return $b['launches'] > $a['launches'] ? 1 : -1; });
sosis_json_out(array('ok' => true, 'games' => array_slice($games, 0, 24)));
