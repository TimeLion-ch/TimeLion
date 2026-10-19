<?php

declare(strict_types=1);

namespace TimeLion\Tests\Maintenance;

use PHPUnit\Framework\TestCase;
use TimeLion\Maintenance\Purger;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\RateLimitRepository;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Tests\Fixtures;
use TimeLion\Tests\FrozenClock;
use TimeLion\Tests\TestDatabase;

final class PurgerTest extends TestCase
{
	private PollRepository $polls;
	private ResponseRepository $responses;
	private RateLimitRepository $rateLimits;
	private FrozenClock $clock;
	private Purger $purger;

	protected function setUp(): void
	{
		$pdo = TestDatabase::migrated();
		$this->polls = new PollRepository($pdo);
		$this->responses = new ResponseRepository($pdo);
		$this->rateLimits = new RateLimitRepository($pdo);
		// The start of a window, so tests can step into the previous and next ones.
		$this->clock = new FrozenClock(1_800_000_000 - 1_800_000_000 % 3600);
		$this->purger = new Purger($this->polls, $this->rateLimits, $this->clock);
	}

	protected function tearDown(): void
	{
		unset($this->polls, $this->responses, $this->rateLimits, $this->purger);
	}

	public function testDeletesExpiredPollsWithTheirResponses(): void
	{
		$now = $this->clock->now();
		$expired = Fixtures::poll(createdAt: $now - 100, expiresAt: $now - 1);
		$expiringNow = Fixtures::poll(createdAt: $now - 100, expiresAt: $now);
		$active = Fixtures::poll(createdAt: $now - 100, expiresAt: $now + 1);
		foreach ([$expired, $expiringNow, $active] as $poll) {
			$this->polls->insert($poll);
			$this->responses->insert(Fixtures::response($poll->id));
		}

		self::assertSame(['polls' => 2, 'rateLimits' => 0], $this->purger->purge());

		self::assertSame(0, $this->responses->countForPoll($expired->id));
		self::assertSame(0, $this->responses->countForPoll($expiringNow->id));
		self::assertNotNull($this->polls->findActive($active->id, $now));
		self::assertSame(1, $this->responses->countForPoll($active->id));
	}

	public function testDeletesClosedPollsOnlyWhenExpired(): void
	{
		$closed = Fixtures::poll(closedAt: $this->clock->now(), expiresAt: $this->clock->now() + 60);
		$this->polls->insert($closed);

		self::assertSame(0, $this->purger->purge()['polls']);

		$this->clock->advance(60);
		self::assertSame(1, $this->purger->purge()['polls']);
	}

	public function testDeletesRowsInsteadOfHidingThem(): void
	{
		$poll = Fixtures::poll(expiresAt: $this->clock->now() + 60);
		$this->polls->insert($poll);
		$this->clock->advance(60);

		$this->purger->purge();

		self::assertNull($this->polls->findActive($poll->id, 0), 'the row is gone, not just filtered out');
		self::assertSame(0, $this->purger->purge()['polls']);
	}

	public function testDeletesRateLimitRowsOfPastWindows(): void
	{
		$now = $this->clock->now();
		$this->rateLimits->hit(str_repeat('a', 64), $now - 3600);
		$this->rateLimits->hit(str_repeat('b', 64), $now - 7200);
		$this->rateLimits->hit(str_repeat('c', 64), $now);

		self::assertSame(['polls' => 0, 'rateLimits' => 2], $this->purger->purge());
		self::assertSame(2, $this->rateLimits->hit(str_repeat('c', 64), $now), 'the current window keeps its count');
	}
}
