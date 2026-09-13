<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if (!sosis_is_admin()) sosis_json_out(array('ok' => false, 'error' => 'unauthorized'), 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
$db = sosis_db_load();
$in = sosis_input();
if (array_key_exists('downloadEnabled', $in)) $db['site']['downloadEnabled'] = (bool) $in['downloadEnabled'];
$strings = array('notes', 'siteName', 'heroTitle', 'heroSub', 'downloadLabel', 'footerText');
foreach ($strings as $k) {
    if (array_key_exists($k, $in)) {
        $v = trim((string) $in[$k]);
        if (function_exists('mb_substr')) $v = mb_substr($v, 0, 3000, 'UTF-8');
        else $v = substr($v, 0, 3000);
        $db['site'][$k] = $v;
    }
}
sosis_db_save($db);
sosis_json_out(array('ok' => true, 'site' => $db['site']));
