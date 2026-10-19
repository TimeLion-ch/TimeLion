<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use TimeLion\Clock;

/**
 * A clock that only moves when the test moves it.
 */
final class FrozenClock implements Clock
{
	public function __construct(
		private int $now = 1_800_000_000,
	) {}

	public function now(): int
	{
		return $this->now;
	}

	public function advance(int $seconds): void
	{
		$this->now += $seconds;
	}
}
