<?php
/* Admin manual credit adjust: POST /api/admin/users/credit {userId, delta} */
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$in = sosis_input();
$userId = isset($in['userId']) ? (string) $in['userId'] : '';
$delta = isset($in['delta']) ? (int) $in['delta'] : 0;
if ($delta === 0) sosis_json_out(array('ok' => false, 'error' => 'bad-delta'), 400);
$db = sosis_db_load();
$out = null;
foreach ($db['users'] as &$u) {
    if ($u['id'] === $userId) {
        $credit = (isset($u['credit']) ? (int) $u['credit'] : 0) + $delta;
        $u['credit'] = $credit < 0 ? 0 : $credit;
        $out = $u;
        break;
    }
}
unset($u);
if (!$out) sosis_json_out(array('ok' => false, 'error' => 'not-found'), 404);
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'user' => sosis_public_user($out)));
