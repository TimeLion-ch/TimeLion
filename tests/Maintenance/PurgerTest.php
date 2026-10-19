<?php

declare(strict_types=1);

namespace TimeLion\Tests\Maintenance;

use PHPUnit\Framework\TestCase;
use TimeLion\Maintenance\Purger;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Tests\Fixtures;
use TimeLion\Tests\FrozenClock;
use TimeLion\Tests\TestDatabase;

final class PurgerTest extends TestCase
{
	private PollRepository $polls;
	private ResponseRepository $responses;
	private FrozenClock $clock;
	private Purger $purger;

	protected function setUp(): void
	{
		$pdo = TestDatabase::migrated();
		$this->polls = new PollRepository($pdo);
		$this->responses = new ResponseRepository($pdo);
		$this->clock = new FrozenClock();
		$this->purger = new Purger($this->polls, $this->clock);
	}

	protected function tearDown(): void
	{
		unset($this->polls, $this->responses, $this->purger);
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

		self::assertSame(['polls' => 2], $this->purger->purge());

		self::assertSame(0, $this->responses->countForPoll($expired->id));
		self::assertSame(0, $this->responses->countForPoll($expiringNow->id));
		self::assertNotNull($this->polls->findActive($active->id, $now));
		self::assertSame(1, $this->responses->countForPoll($active->id));
	}

	public function testDeletesClosedPollsOnlyWhenExpired(): void
	{
		$closed = Fixtures::poll(closedAt: $this->clock->now(), expiresAt: $this->clock->now() + 60);
		$this->polls->insert($closed);

		self::assertSame(['polls' => 0], $this->purger->purge());

		$this->clock->advance(60);
		self::assertSame(['polls' => 1], $this->purger->purge());
	}

	public function testDeletesRowsInsteadOfHidingThem(): void
	{
		$poll = Fixtures::poll(expiresAt: $this->clock->now() + 60);
		$this->polls->insert($poll);
		$this->clock->advance(60);

		$this->purger->purge();

		self::assertNull($this->polls->findActive($poll->id, 0), 'the row is gone, not just filtered out');
		self::assertSame(['polls' => 0], $this->purger->purge());
	}
}
