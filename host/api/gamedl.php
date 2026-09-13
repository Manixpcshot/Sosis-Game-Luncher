<?php
/* Game file download: GET /gamedl/<gameId>/<file> — free OR owned OR admin */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$gameId = isset($_GET['id']) ? (string) $_GET['id'] : '';
$reqFile = isset($_GET['file']) ? basename(rawurldecode((string) $_GET['file'])) : '';
$game = null;
foreach ($db['store']['games'] as $g) { if ($g['id'] === $gameId) { $game = $g; break; } }
if (!$game || $game['kind'] !== 'upload' || empty($game['file'])) {
    http_response_code(404);
    exit('not found');
}
if (!empty($game['file']) && $reqFile !== '' && $reqFile !== basename($game['file'])) {
    http_response_code(404);
    exit('not found');
}
$fileName = basename($game['file']);
$path = SOSIS_GAMEDATA . '/' . $game['id'] . '/' . $fileName;
if (!is_file($path)) {
    http_response_code(404);
    exit('not found');
}

$allowed = sosis_is_admin() || ((int) $game['price']) <= 0;
if (!$allowed) {
    $user = sosis_current_user();
    if ($user && isset($user['ownedGames']) && is_array($user['ownedGames']) && in_array($game['id'], $user['ownedGames'], true)) {
        $allowed = true;
    }
}
if (!$allowed) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => 'purchase-required'));
    exit;
}

/* count download once per request */
foreach ($db['store']['games'] as &$g) {
    if ($g['id'] === $game['id']) {
        $g['downloads'] = (isset($g['downloads']) ? (int) $g['downloads'] : 0) + 1;
        break;
    }
}
unset($g);
sosis_db_save($db);

while (ob_get_level() > 0) { @ob_end_clean(); }
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
header('Content-Length: ' . filesize($path));
header('Content-Transfer-Encoding: binary');
header('Cache-Control: no-store');
header('X-Accel-Redirect: ' . str_replace(SOSIS_ROOT, '', $path)); /* nginx fast path if present */
@readfile($path);
exit;
