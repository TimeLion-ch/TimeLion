<?php

declare(strict_types=1);

namespace TimeLion\Maintenance;

use TimeLion\Clock;
use TimeLion\Repository\PollRepository;

/**
 * Deletes expired data for good: every poll expires, and expired polls are deleted, not hidden (CLAUDE.md, rule 8).
 *
 * Runs on a small share of API requests (PurgeMiddleware) and from bin/purge.php on hosts with cron.
 */
final readonly class Purger
{
	public function __construct(
		private PollRepository $polls,
		private Clock $clock,
	) {}

	/**
	 * @return array{polls: int} how many rows were deleted
	 */
	public function purge(): array
	{
		return ['polls' => $this->polls->deleteExpired($this->clock->now())];
	}
}
