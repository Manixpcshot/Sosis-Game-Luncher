<?php
/* Public site config: GET /api/site/config */
require_once __DIR__ . '/_lib.php';
sosis_cors();
$db = sosis_db_load();
$s = $db['site'];
sosis_json_out(array(
    'ok' => true,
    'downloadEnabled' => (bool) $s['downloadEnabled'],
    'latestVersion' => $s['latestVersion'],
    'notes' => $s['notes'],
    'downloadUrl' => $s['downloadEnabled'] ? '/datasetup/' . basename($s['installerFile']) : null,
    'siteName' => isset($s['siteName']) ? $s['siteName'] : 'Sosis Launcher',
    'heroTitle' => isset($s['heroTitle']) ? $s['heroTitle'] : '',
    'heroSub' => isset($s['heroSub']) ? $s['heroSub'] : '',
    'downloadLabel' => isset($s['downloadLabel']) ? $s['downloadLabel'] : '',
    'footerText' => isset($s['footerText']) ? $s['footerText'] : ''
));
