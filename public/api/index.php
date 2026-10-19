<?php

declare(strict_types=1);

use TimeLion\Config;
use TimeLion\Kernel;

require dirname(__DIR__, 2) . '/vendor/autoload.php';

header_remove('X-Powered-By');
// Shared hosts may have display_errors on: PHP's own error output must never end up in an API response. And its own
// stack traces (e.g. for an uncaught exception) must not contain call arguments, which can hold tokens.
ini_set('display_errors', '0');
ini_set('zend.exception_ignore_args', '1');

try {
	$app = Kernel::createApp(Config::load());
} catch (Throwable $exception) {
	// Booting failed (e.g. missing or invalid config.php). Log the reason, never show it to the client.
	error_log('[TimeLion] Bootstrap failed: ' . $exception->getMessage());
	http_response_code(500);
	header('Content-Type: application/json');
	header('Cache-Control: no-store');
	echo '{"error":{"code":"internal_error","message":"Internal server error."}}';

	exit;
}

$app->run();
