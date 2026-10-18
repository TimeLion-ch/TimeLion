<?php

declare(strict_types=1);

use TimeLion\Config;
use TimeLion\Kernel;

require dirname(__DIR__, 2) . '/vendor/autoload.php';

header_remove('X-Powered-By');

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
