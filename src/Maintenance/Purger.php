<?php

declare(strict_types=1);

namespace TimeLion\Maintenance;

use TimeLion\Clock;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\RateLimitRepository;
use TimeLion\Security\RateLimiter;

/**
 * Deletes expired data for good: every poll expires, and expired polls are deleted, not hidden (CLAUDE.md, rule 8).
 * Stale rate-limit counters go as well.
 *
 * Runs on a small share of API requests (PurgeMiddleware) and from bin/purge.php on hosts with cron.
 */
final readonly class Purger
{
	public function __construct(
		private PollRepository $polls,
		private RateLimitRepository $rateLimits,
		private Clock $clock,
	) {}

	/**
	 * Deletes expired polls (with their responses) and the rate-limit rows of past windows.
	 *
	 * @return array{polls: int, rateLimits: int} how many rows were deleted
	 */
	public function purge(): array
	{
		$now = $this->clock->now();

		return [
			'polls' => $this->polls->deleteExpired($now),
			'rateLimits' => $this->rateLimits->deleteBefore(RateLimiter::windowStart($now)),
		];
	}
}
