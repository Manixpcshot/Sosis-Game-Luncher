<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
sosis_clear_cookie('sosis_admin');
sosis_json_out(array('ok' => true));
