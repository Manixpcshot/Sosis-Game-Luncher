<?php
/* Claim a FREE store game: POST /api/store/claim {gameId} */
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$user = sosis_current_user();
if (!$user) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
$in = sosis_input();
$gameId = isset($in['gameId']) ? (string) $in['gameId'] : '';
$db = sosis_db_load();
$game = null;
foreach ($db['store']['games'] as $g) { if ($g['id'] === $gameId) { $game = $g; break; } }
if (!$game || empty($game['published'])) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);
if ((int) $game['price'] > 0) sosis_json_out(array('ok' => false, 'error' => 'not-free'), 400);
foreach ($db['users'] as &$u) {
    if ($u['id'] === $user['id']) {
        if (!isset($u['ownedGames']) || !is_array($u['ownedGames'])) $u['ownedGames'] = array();
        if (!in_array($gameId, $u['ownedGames'], true)) $u['ownedGames'][] = $gameId;
        $user = $u;
        break;
    }
}
unset($u);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'user' => sosis_public_user($user)));
