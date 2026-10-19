<?php

declare(strict_types=1);

namespace TimeLion\Tests\Repository;

use PDO;
use PHPUnit\Framework\TestCase;
use TimeLion\Polls\Poll;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Tests\Fixtures;
use TimeLion\Tests\TestDatabase;

final class PollRepositoryTest extends TestCase
{
	private const int NOW = 1_800_000_000;

	private PDO $pdo;
	private PollRepository $polls;

	protected function setUp(): void
	{
		$this->pdo = TestDatabase::migrated();
		$this->polls = new PollRepository($this->pdo);
	}

	protected function tearDown(): void
	{
		unset($this->pdo, $this->polls);
	}

	public function testInsertedPollIsFoundWithAllFields(): void
	{
		$open = Fixtures::poll(createdAt: self::NOW - 10, updatedAt: self::NOW - 5, expiresAt: self::NOW + 60);
		$closed = Fixtures::poll(closedAt: self::NOW - 1);
		$this->polls->insert($open);
		$this->polls->insert($closed);

		self::assertEquals($open, $this->polls->findActive($open->id, self::NOW));
		self::assertEquals($closed, $this->polls->findActive($closed->id, self::NOW));
		self::assertNull($this->polls->findActive($open->id, self::NOW)?->closedAt);
	}

	public function testUnknownPollIsNotFound(): void
	{
		$this->polls->insert(Fixtures::poll());

		self::assertNull($this->polls->findActive(str_repeat('0', 32), self::NOW));
	}

	public function testExpiredPollIsNotFound(): void
	{
		$poll = Fixtures::poll(expiresAt: self::NOW + 1);
		$this->polls->insert($poll);

		self::assertNotNull($this->polls->findActive($poll->id, self::NOW), 'one second before expiry');
		self::assertNull($this->polls->findActive($poll->id, self::NOW + 1), 'at the expiry time');
		self::assertNull($this->polls->findActive($poll->id, self::NOW + 2), 'after the expiry time');
	}

	public function testUpdateWritesOnlyTheMutableColumns(): void
	{
		$poll = Fixtures::poll(adminToken: 'original', createdAt: self::NOW);
		$this->polls->insert($poll);

		$changed = new Poll(
			id: $poll->id,
			adminTokenHash: Fixtures::poll(adminToken: 'replaced')->adminTokenHash,
			ciphertext: Fixtures::ciphertext('X'),
			createdAt: self::NOW + 1000,
			updatedAt: self::NOW + 10,
			expiresAt: self::NOW + 90 * 86400,
			closedAt: self::NOW + 10,
		);
		$this->polls->update($changed);

		self::assertEquals(
			new Poll($poll->id, $poll->adminTokenHash, $changed->ciphertext, $poll->createdAt, $changed->updatedAt, $changed->expiresAt, $changed->closedAt),
			$this->polls->findActive($poll->id, self::NOW),
		);
	}

	public function testUpdateCanReopenAPoll(): void
	{
		$poll = Fixtures::poll(closedAt: self::NOW);
		$this->polls->insert($poll);

		$this->polls->update(new Poll($poll->id, $poll->adminTokenHash, $poll->ciphertext, $poll->createdAt, self::NOW, $poll->expiresAt, null));

		self::assertNull($this->polls->findActive($poll->id, self::NOW)?->closedAt);
	}

	public function testUpdateLeavesOtherPollsAlone(): void
	{
		$poll = Fixtures::poll();
		$other = Fixtures::poll();
		$this->polls->insert($poll);
		$this->polls->insert($other);

		$this->polls->update(new Poll($poll->id, $poll->adminTokenHash, Fixtures::ciphertext('X'), $poll->createdAt, self::NOW, $poll->expiresAt, self::NOW));

		self::assertEquals($other, $this->polls->findActive($other->id, self::NOW));
	}

	public function testDeleteCascadesToResponses(): void
	{
		$responses = new ResponseRepository($this->pdo);
		$poll = Fixtures::poll();
		$other = Fixtures::poll();
		$this->polls->insert($poll);
		$this->polls->insert($other);
		$responses->insert(Fixtures::response($poll->id));
		$responses->insert(Fixtures::response($poll->id));
		$kept = Fixtures::response($other->id);
		$responses->insert($kept);

		$this->polls->delete($poll->id);

		self::assertNull($this->polls->findActive($poll->id, self::NOW));
		self::assertSame(0, $responses->countForPoll($poll->id));
		self::assertEquals($other, $this->polls->findActive($other->id, self::NOW));
		self::assertEquals([$kept], $responses->listForPoll($other->id));
	}
}
