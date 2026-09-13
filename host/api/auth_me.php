<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
$user = sosis_current_user();
sosis_json_out(array('ok' => (bool) $user, 'user' => sosis_public_user($user)));
