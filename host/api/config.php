<?php
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = $db['site'];
sosis_json_out(array(
    'ok' => true,
    'downloadEnabled' => (bool) $s['downloadEnabled'],
    'latestVersion' => $s['latestVersion'],
    'notes' => $s['notes'],
    'downloadUrl' => $s['downloadEnabled'] ? '/datasetup/' . $s['installerFile'] : null
));
