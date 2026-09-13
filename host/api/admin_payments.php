<?php
/* Admin payments review:
   GET  /api/admin/payments                  -> all payments (pending first)
   POST /api/admin/payments {paymentId, action:'approve'|'reject', amount?} */
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
$db = sosis_db_load();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $all = $db['payments'];
    usort($all, function ($a, $b) {
        $pa = $a['status'] === 'pending' ? 1 : 0;
        $pb = $b['status'] === 'pending' ? 1 : 0;
        if ($pa !== $pb) return $pb - $pa;
        return $b['createdAt'] - $a['createdAt'];
    });
    sosis_json_out(array('ok' => true, 'payments' => $all));
}

if ($method !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$in = sosis_input();
$payId = isset($in['paymentId']) ? (string) $in['paymentId'] : '';
$action = isset($in['action']) ? (string) $in['action'] : '';
if (!in_array($action, array('approve', 'reject'), true)) sosis_json_out(array('ok' => false, 'error' => 'bad-action'), 400);

$pidx = -1;
foreach ($db['payments'] as $i => $p) { if ($p['id'] === $payId) { $pidx = $i; break; } }
if ($pidx < 0) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);
$p = $db['payments'][$pidx];
if ($p['status'] !== 'pending') sosis_json_out(array('ok' => false, 'error' => 'already-reviewed'), 400);

if ($action === 'approve') {
    $amount = isset($in['amount']) ? max(0, (int) $in['amount']) : (int) $p['amount'];
    $found = false;
    foreach ($db['users'] as &$u) {
        if ($u['id'] === $p['userId']) {
            $u['credit'] = (isset($u['credit']) ? (int) $u['credit'] : 0) + $amount;
            $found = true;
            break;
        }
    }
    unset($u);
    if (!$found) sosis_json_out(array('ok' => false, 'error' => 'user-missing'), 404);
    $db['payments'][$pidx]['amount'] = $amount;
}
$db['payments'][$pidx]['status'] = $action === 'approve' ? 'approved' : 'rejected';
$db['payments'][$pidx]['reviewedAt'] = time() * 1000;
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'payment' => $db['payments'][$pidx]));
