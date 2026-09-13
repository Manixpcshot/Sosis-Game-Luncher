<?php
/* Store catalog: GET /api/store/games (public; owned flags when logged in) */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$user = sosis_current_user();
$owned = array();
$credit = 0;
if ($user) {
    $owned = isset($user['ownedGames']) && is_array($user['ownedGames']) ? $user['ownedGames'] : array();
    $credit = isset($user['credit']) ? (int) $user['credit'] : 0;
}
$isAdmin = sosis_is_admin();
$games = array();
foreach ($db['store']['games'] as $g) {
    if (empty($g['published']) && !$isAdmin) continue;
    $isOwned = in_array($g['id'], $owned, true);
    $free = ((int) $g['price']) <= 0;
    $canSeeUrl = $free || $isOwned || $isAdmin;
    $item = array(
        'id' => $g['id'],
        'name' => $g['name'],
        'description' => isset($g['description']) ? $g['description'] : '',
        'price' => (int) $g['price'],
        'kind' => $g['kind'],
        'size' => isset($g['size']) ? (int) $g['size'] : 0,
        'sha256' => isset($g['sha256']) ? $g['sha256'] : null,
        'file' => isset($g['file']) ? $g['file'] : null,
        'cover' => !empty($g['cover']) ? '/assets/store/' . $g['cover'] : null,
        'banner' => !empty($g['banner']) ? '/assets/store/' . $g['banner'] : null,
        'hoverImage' => !empty($g['hoverImage']) ? '/assets/store/' . $g['hoverImage'] : null,
        'downloads' => isset($g['downloads']) ? (int) $g['downloads'] : 0,
        'published' => !empty($g['published']),
        'owned' => $isOwned,
        'createdAt' => isset($g['createdAt']) ? $g['createdAt'] : 0
    );
    if ($g['kind'] === 'link') {
        $item['url'] = $canSeeUrl ? $g['linkUrl'] : null;
    } else {
        $item['url'] = ($canSeeUrl && !empty($g['file'])) ? '/gamedl/' . $g['id'] . '/' . rawurlencode($g['file']) : null;
    }
    $games[] = $item;
}
$s = $db['site'];
sosis_json_out(array(
    'ok' => true,
    'games' => $games,
    'meta' => array(
        'loggedIn' => (bool) $user,
        'username' => $user ? $user['username'] : null,
        'credit' => $credit,
        'currency' => 'تومان',
        'cardNumber' => isset($s['cardNumber']) ? $s['cardNumber'] : '',
        'cardHolder' => isset($s['cardHolder']) ? $s['cardHolder'] : '',
        'paymentNote' => isset($s['paymentNote']) ? $s['paymentNote'] : ''
    )
));
