<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use PHPUnit\Framework\TestCase;
use TimeLion\Clock;
use TimeLion\Kernel;
use TimeLion\SystemClock;

final class SystemClockTest extends TestCase
{
	public function testReturnsTheCurrentUnixTime(): void
	{
		$before = time();
		$now = (new SystemClock())->now();

		self::assertGreaterThanOrEqual($before, $now);
		self::assertLessThanOrEqual(time(), $now);
	}

	public function testKernelProvidesTheSystemClock(): void
	{
		$app = Kernel::createApp(TestDatabase::config());

		self::assertInstanceOf(SystemClock::class, $app->getContainer()->get(Clock::class));
	}
}
