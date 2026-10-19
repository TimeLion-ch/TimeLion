<?php

declare(strict_types=1);

/*
 * Configuration for the end-to-end tests: e2e/server.mjs passes it as TIMELION_CONFIG. The database is recreated for
 * every run. Never use this file for anything else; its secret is public.
 */

return [
	'env' => 'prod',
	'db' => [
		'dsn' => 'sqlite:' . dirname(__DIR__, 2) . '/var/e2e.sqlite',
		'user' => null,
		'password' => null,
	],
	'secret' => 'end-to-end-tests-only-this-secret-is-public',
	'trusted_proxy_header' => null,
];
