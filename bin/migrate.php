#!/usr/bin/env php
<?php

declare(strict_types=1);

use TimeLion\Config;
use TimeLion\Database\ConnectionFactory;
use TimeLion\Database\Migrator;

if (PHP_SAPI !== 'cli') {
	exit(1);
}

require dirname(__DIR__) . '/vendor/autoload.php';

$migrator = new Migrator(ConnectionFactory::create(Config::load()), dirname(__DIR__) . '/migrations');

if (in_array('--status', $argv, true)) {
	foreach ($migrator->available() as $version) {
		$state = in_array($version, $migrator->applied(), true) ? 'applied' : 'pending';
		echo sprintf('%-8s %s', $state, $version), PHP_EOL;
	}

	exit(0);
}

try {
	$applied = $migrator->migrate();
} catch (Throwable $exception) {
	fwrite(STDERR, $exception->getMessage() . PHP_EOL);

	exit(1);
}

echo $applied === []
	? 'Database is up to date.' . PHP_EOL
	: 'Applied: ' . implode(', ', $applied) . PHP_EOL;
