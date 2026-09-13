<?php
/**
 * OPTIONAL local preview only (NOT needed on cPanel):
 *   php -S 0.0.0.0:8080 router.php
 * Emulates the .htaccess rewrites with PHP's built-in server.
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$map = array(
    '#^/api/site/config$#'        => '/api/config.php',
    '#^/api/auth/register$#'      => '/api/auth_register.php',
    '#^/api/auth/login$#'         => '/api/auth_login.php',
    '#^/api/auth/weblogin$#'      => '/api/auth_weblogin.php',
    '#^/api/auth/logout$#'        => '/api/auth_logout.php',
    '#^/api/auth/me$#'            => '/api/auth_me.php',
    '#^/api/auth/avatar$#'        => '/api/auth_avatar.php',
    '#^/api/sync/session$#'       => '/api/sync_session.php',
    '#^/api/leaderboard$#'        => '/api/leaderboard.php',
    '#^/api/games/popular$#'      => '/api/popular.php',
    '#^/api/admin/login$#'        => '/api/admin_login.php',
    '#^/api/admin/state$#'        => '/api/admin_state.php',
    '#^/api/admin/files/upload$#' => '/api/admin_upload.php',
    '#^/api/admin/files/(.+)$#'   => '/api/admin_delete.php',
    '#^/api/admin/publish$#'      => '/api/admin_publish.php',
    '#^/api/admin/config$#'       => '/api/admin_config.php',
    '#^/api/admin/password$#'     => '/api/admin_password.php',
    '#^/api/admin/logout$#'       => '/api/admin_logout.php',
    '#^/api/store/games$#'        => '/api/store_games.php',
    '#^/api/store/claim$#'        => '/api/store_claim.php',
    '#^/api/store/buy$#'          => '/api/store_buy.php',
    '#^/api/store/payments?$#'    => '/api/store_payment.php',
    '#^/api/admin/games/upload$#' => '/api/admin_game_upload.php',
    '#^/api/admin/games/?$#'      => '/api/admin_games.php',
    '#^/api/admin/games/([^/]+)$#' => '/api/admin_games.php',
    '#^/api/admin/payments$#'     => '/api/admin_payments.php',
    '#^/api/admin/users/credit$#' => '/api/admin_credit.php',
    '#^/gamedl/([^/]+)/(.+)$#'    => '/api/gamedl.php',
    '#^/datasetup/?$#'            => '/api/manifest.php',
    '#^/datasetup/(.+)$#'         => '/api/dl.php',
    '#^/latest\.json$#'           => '/api/latest.php',
);
foreach ($map as $re => $target) {
    if (preg_match($re, $uri, $m)) {
        if (isset($m[1])) $_GET['file'] = $m[1];
        require __DIR__ . $target;
        return;
    }
}
$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) return false; // serve static
require __DIR__ . '/index.html';
