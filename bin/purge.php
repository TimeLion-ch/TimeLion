#!/usr/bin/env php
<?php

declare(strict_types=1);

/*
 * Deletes expired polls (with their responses). API requests already do this now and then; on hosts with cron,
 * run it regularly as well, e.g. hourly:  php bin/purge.php
 */

use TimeLion\Config;
use TimeLion\Kernel;
use TimeLion\Maintenance\Purger;

if (PHP_SAPI !== 'cli') {
	exit(1);
}

require dirname(__DIR__) . '/vendor/autoload.php';

try {
	$purger = Kernel::createContainer(Config::load())->get(Purger::class);
	if (!$purger instanceof Purger) {
		throw new RuntimeException('The container did not return a Purger.');
	}
	$deleted = $purger->purge();
} catch (Throwable $exception) {
	fwrite(STDERR, $exception->getMessage() . PHP_EOL);

	exit(1);
}

echo sprintf('Deleted %d expired poll(s).', $deleted['polls']), PHP_EOL;
