<?php

declare(strict_types=1);

/*
 * TimeLion configuration.
 *
 * Copy this file to config.php in the same directory (the app root, outside public/) and adjust it.
 * config.php is never committed and never overwritten by deployments.
 */

return [
	// 'prod' hides error details from API responses, 'dev' shows them.
	'env' => 'prod',

	'db' => [
		// SQLite – the file must be outside public/ and its directory writable:
		'dsn' => 'sqlite:' . __DIR__ . '/var/timelion.sqlite',
		// MySQL / MariaDB:
		// 'dsn' => 'mysql:host=localhost;port=3306;dbname=timelion;charset=utf8mb4',
		'user' => null,
		'password' => null,
	],

	// At least 32 random characters. Generate one with:
	//   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
	// Changing it later only resets rate-limit counters.
	'secret' => '',

	// Rate limits count requests per client IP (only an HMAC of it is stored). Behind a reverse proxy or load
	// balancer, every request seems to come from the proxy, so name the header it passes the client IP in, e.g.
	// 'X-Forwarded-For' (its last entry is used) or 'X-Real-IP'. Leave null unless clients can only reach the app
	// through that proxy: otherwise anyone can send the header and pick their own address.
	'trusted_proxy_header' => null,

	// The privacy policy (German), shown at /privacy and linked in the footer; null shows "not set up yet" there.
	'privacy_policy' => null,
];
