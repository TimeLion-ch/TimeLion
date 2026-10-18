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
];
