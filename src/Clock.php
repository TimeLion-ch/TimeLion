<?php

declare(strict_types=1);

namespace TimeLion;

/**
 * The current time, injected so that expiry and rate limits are testable (tests use FrozenClock).
 */
interface Clock
{
	/**
	 * @return int Unix seconds
	 */
	public function now(): int;
}
