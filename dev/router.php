<?php

declare(strict_types=1);

/*
 * Router for PHP's built-in web server – mirrors public/.htaccess for local development:
 *
 *   composer serve   (= php -S localhost:8000 -t public dev/router.php)
 *
 * /api/* goes to Slim, existing files are served as-is, everything else gets the single-page app.
 * The Content-Security-Policy is read from the generated public/.htaccess, so CSP problems show up locally.
 */

$public = dirname(__DIR__) . '/public';
$path = parse_url(is_string($_SERVER['REQUEST_URI'] ?? null) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$path = is_string($path) ? rawurldecode($path) : '/';

if ($path === '/api' || str_starts_with($path, '/api/')) {
	require $public . '/api/index.php';

	return true;
}

if ($path !== '/' && !str_contains($path, '..') && is_file($public . $path)) {
	return false;
}

$index = $public . '/index.html';
if (!is_file($index)) {
	http_response_code(503);
	header('Content-Type: text/plain; charset=utf-8');
	echo "Frontend not built yet. Run: npm --prefix frontend run build\n";

	return true;
}

$htaccess = @file_get_contents($public . '/.htaccess');
if (is_string($htaccess) && preg_match('/Header always set Content-Security-Policy "([^"]+)"/', $htaccess, $match) === 1) {
	header('Content-Security-Policy: ' . $match[1]);
}
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('Content-Type: text/html; charset=utf-8');
readfile($index);

return true;
