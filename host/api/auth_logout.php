<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sosis_json_out(array('ok' => false, 'error' => 'method'), 405);
sosis_clear_cookie('sosis_token');
sosis_json_out(array('ok' => true));
