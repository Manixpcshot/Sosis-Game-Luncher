<?php
/* Payments: POST /api/store/payment {gameId, dataUrl, note} — submit receipt
   GET  /api/store/payments — my payment history */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$user = sosis_current_user();
if (!$user) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
$db = sosis_db_load();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $mine = array();
    foreach ($db['payments'] as $p) {
        if ($p['userId'] !== $user['id']) continue;
        $mine[] = array(
            'id' => $p['id'], 'gameId' => $p['gameId'], 'gameName' => $p['gameName'],
            'amount' => (int) $p['amount'], 'status' => $p['status'],
            'receipt' => $p['receipt'], 'note' => isset($p['note']) ? $p['note'] : '',
            'createdAt' => $p['createdAt'], 'reviewedAt' => isset($p['reviewedAt']) ? $p['reviewedAt'] : null
        );
    }
    usort($mine, function ($a, $b) { return $b['createdAt'] - $a['createdAt']; });
    sosis_json_out(array('ok' => true, 'payments' => $mine));
}

if ($method !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$in = sosis_input();
$gameId = isset($in['gameId']) ? (string) $in['gameId'] : '';
$dataUrl = isset($in['dataUrl']) ? (string) $in['dataUrl'] : '';
$note = isset($in['note']) ? mb_substr(trim((string) $in['note']), 0, 500) : '';
$game = null;
foreach ($db['store']['games'] as $g) { if ($g['id'] === $gameId) { $game = $g; break; } }
if (!$game || empty($game['published'])) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);
if ((int) $game['price'] <= 0) sosis_json_out(array('ok' => false, 'error' => 'is-free'), 400);

/* duplicate pending payment for same user+game? */
foreach ($db['payments'] as $p) {
    if ($p['userId'] === $user['id'] && $p['gameId'] === $gameId && $p['status'] === 'pending') {
        sosis_json_out(array('ok' => false, 'error' => 'already-pending'), 400);
    }
}

$id = sosis_new_id('pay');
$receiptName = sosis_save_image_data_url($dataUrl, SOSIS_PAYIMG, $id, 5 * 1024 * 1024);
if (!$receiptName) sosis_json_out(array('ok' => false, 'error' => 'bad-image'), 400);

$db['payments'][] = array(
    'id' => $id,
    'userId' => $user['id'],
    'username' => $user['username'],
    'gameId' => $gameId,
    'gameName' => $game['name'],
    'amount' => (int) $game['price'],
    'receipt' => '/assets/payments/' . $receiptName,
    'note' => $note,
    'status' => 'pending',
    'createdAt' => time() * 1000,
    'reviewedAt' => null
);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'id' => $id, 'status' => 'pending'));
