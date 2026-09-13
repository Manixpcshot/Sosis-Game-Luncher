<?php
/**
 * Sosis Launcher — Web Platform (cPanel / shared-host edition, pure PHP).
 * Shared library: JSON db, HMAC tokens, password hashing, CORS, helpers.
 * PHP 7.4+ / 8.x — no composer, no framework, no Node.
 */

define('SOSIS_ROOT', dirname(__DIR__));
define('SOSIS_DATA', SOSIS_ROOT . '/data');
define('SOSIS_DB', SOSIS_DATA . '/db.json');
define('SOSIS_SECRET_FILE', SOSIS_DATA . '/secret.key');
define('SOSIS_DOWNLOADS', SOSIS_ROOT . '/datasetup');
define('SOSIS_AVATARS', SOSIS_ROOT . '/assets/avatars');
define('SOSIS_STOREIMG', SOSIS_ROOT . '/assets/store');
define('SOSIS_PAYIMG', SOSIS_ROOT . '/assets/payments');
define('SOSIS_GAMEDATA', SOSIS_ROOT . '/gamedata');

function sosis_json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sosis_cors() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: content-type, authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function sosis_input() {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw, true);
    return is_array($j) ? $j : array();
}

function sosis_db_defaults() {
    return array(
        'users' => array(),
        'games' => array(),
        'sessions' => array(),
        'site' => array(
            'downloadEnabled' => true,
            'latestVersion' => '1.1.0',
            'notes' => '',
            'installerFile' => 'SosisLauncherSetup.exe',
            'sha256' => null,
            'size' => 0,
            'releasedAt' => null,
            'siteName' => 'Sosis Launcher',
            'heroTitle' => '',
            'heroSub' => '',
            'downloadLabel' => '',
            'footerText' => '',
            'cardNumber' => '',
            'cardHolder' => '',
            'paymentNote' => ''
        ),
        'store' => array('games' => array()),
        'payments' => array(),
        'admin' => null
    );
}

function sosis_db_load() {
    static $db = null;
    if ($db !== null) return $db;
    if (!is_dir(SOSIS_DATA)) @mkdir(SOSIS_DATA, 0755, true);
    if (!is_dir(SOSIS_DOWNLOADS)) @mkdir(SOSIS_DOWNLOADS, 0755, true);
    if (!is_dir(SOSIS_AVATARS)) @mkdir(SOSIS_AVATARS, 0755, true);
    if (!is_dir(SOSIS_STOREIMG)) @mkdir(SOSIS_STOREIMG, 0755, true);
    if (!is_dir(SOSIS_PAYIMG)) @mkdir(SOSIS_PAYIMG, 0755, true);
    if (!is_dir(SOSIS_GAMEDATA)) @mkdir(SOSIS_GAMEDATA, 0755, true);
    $db = sosis_db_defaults();
    if (file_exists(SOSIS_DB)) {
        $raw = @file_get_contents(SOSIS_DB);
        $parsed = json_decode($raw, true);
        if (is_array($parsed)) {
            $db = array_merge($db, $parsed);
            $db['site'] = array_merge(sosis_db_defaults()['site'], isset($parsed['site']) && is_array($parsed['site']) ? $parsed['site'] : array());
        } else {
            @rename(SOSIS_DB, SOSIS_DB . '.corrupt-' . time());
        }
    }
    if ($db['admin'] === null) {
        $initial = getenv('ADMIN_PASSWORD') ? getenv('ADMIN_PASSWORD') : 'mani2010';
        $db['admin'] = array('hash' => password_hash($initial, PASSWORD_DEFAULT), 'changed' => false);
        sosis_db_save($db);
    }
    return $db;
}

function sosis_db_save($db) {
    if (!is_dir(SOSIS_DATA)) @mkdir(SOSIS_DATA, 0755, true);
    $tmp = SOSIS_DB . '.tmp';
    @file_put_contents($tmp, json_encode($db, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    @rename($tmp, SOSIS_DB);
}

function sosis_secret() {
    if (file_exists(SOSIS_SECRET_FILE)) {
        $s = trim(@file_get_contents(SOSIS_SECRET_FILE));
        if ($s) return $s;
    }
    $s = bin2hex(random_bytes(32));
    @file_put_contents(SOSIS_SECRET_FILE, $s, LOCK_EX);
    @chmod(SOSIS_SECRET_FILE, 0600);
    return $s;
}

function sosis_b64url_encode($bin) {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
function sosis_b64url_decode($str) {
    return base64_decode(strtr($str, '-_', '+/'));
}

function sosis_make_token($uid, $role = null) {
    $payload = sosis_b64url_encode(json_encode(array('uid' => $uid, 'role' => $role, 'iat' => time())));
    $sig = sosis_b64url_encode(hash_hmac('sha256', $payload, sosis_secret(), true));
    return $payload . '.' . $sig;
}

function sosis_verify_token($token) {
    if (!$token || substr_count($token, '.') !== 1) return null;
    list($payload, $sig) = explode('.', $token);
    $expect = sosis_b64url_encode(hash_hmac('sha256', $payload, sosis_secret(), true));
    if (!hash_equals($expect, $sig)) return null;
    $data = json_decode(sosis_b64url_decode($payload), true);
    return is_array($data) ? $data : null;
}

function sosis_bearer_token() {
    $h = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
    }
    if (!$h && isset($_SERVER['HTTP_AUTHORIZATION'])) $h = $_SERVER['HTTP_AUTHORIZATION'];
    if (!$h && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (strpos($h, 'Bearer ') === 0) return substr($h, 7);
    return null;
}

function sosis_cookie_token($name) {
    if (isset($_COOKIE[$name])) return $_COOKIE[$name];
    return null;
}

function sosis_current_user() {
    $db = sosis_db_load();
    $token = sosis_bearer_token();
    if (!$token) $token = sosis_cookie_token('sosis_token');
    $payload = sosis_verify_token($token);
    if (!$payload || empty($payload['uid'])) return null;
    foreach ($db['users'] as $u) {
        if ($u['id'] === $payload['uid']) return $u;
    }
    return null;
}

function sosis_is_admin() {
    $payload = sosis_verify_token(sosis_cookie_token('sosis_admin'));
    return $payload && isset($payload['role']) && $payload['role'] === 'admin';
}

function sosis_public_user($u) {
    if (!$u) return null;
    return array(
        'id' => $u['id'],
        'username' => $u['username'],
        'email' => isset($u['email']) ? $u['email'] : null,
        'avatar' => !empty($u['avatar']) ? '/assets/avatars/' . $u['avatar'] : null,
        'totalPlayTime' => isset($u['totalPlayTime']) ? $u['totalPlayTime'] : 0,
        'totalSessions' => isset($u['totalSessions']) ? $u['totalSessions'] : 0,
        'launchCount' => isset($u['launchCount']) ? $u['launchCount'] : 0,
        'createdAt' => isset($u['createdAt']) ? $u['createdAt'] : 0,
        'credit' => isset($u['credit']) ? (int) $u['credit'] : 0,
        'ownedGames' => isset($u['ownedGames']) && is_array($u['ownedGames']) ? array_values($u['ownedGames']) : array()
    );
}

/** Save a data:image/... base64 URL to $dir/$prefix.<ext>; returns file name or null. */
function sosis_save_image_data_url($dataUrl, $dir, $prefix, $maxBytes = 8388608) {
    if (!preg_match('/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=]+)$/', (string) $dataUrl, $m)) return null;
    $bin = base64_decode($m[2]);
    if ($bin === false || strlen($bin) > $maxBytes) return null;
    $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $name = preg_replace('/[^A-Za-z0-9_-]/', '', $prefix) . '.' . $ext;
    foreach (array('png', 'jpg', 'webp', 'gif') as $old) {
        if ($old !== $ext && file_exists($dir . '/' . preg_replace('/[^A-Za-z0-9_-]/', '', $prefix) . '.' . $old)) {
            @unlink($dir . '/' . preg_replace('/[^A-Za-z0-9_-]/', '', $prefix) . '.' . $old);
        }
    }
    if (@file_put_contents($dir . '/' . $name, $bin, LOCK_EX) === false) return null;
    return $name;
}

function sosis_new_id($prefix) {
    return $prefix . '-' . substr(bin2hex(random_bytes(8)), 0, 12);
}

function sosis_set_cookie($name, $value, $days, $sameSite = 'Lax') {
    setcookie($name, $value, array(
        'expires' => time() + $days * 86400,
        'path' => '/',
        'httponly' => true,
        'samesite' => $sameSite,
        'secure' => !empty($_SERVER['HTTPS'])
    ));
}

function sosis_clear_cookie($name) {
    setcookie($name, '', array('expires' => time() - 3600, 'path' => '/', 'httponly' => true));
}

function sosis_random_id() {
    return bin2hex(random_bytes(12));
}
