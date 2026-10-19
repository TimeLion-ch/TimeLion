<?php

declare(strict_types=1);

namespace TimeLion\Tests\Repository;

use PHPUnit\Framework\TestCase;
use TimeLion\Polls\Poll;
use TimeLion\Polls\PollResponse;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Tests\Fixtures;
use TimeLion\Tests\TestDatabase;

final class ResponseRepositoryTest extends TestCase
{
	private const int NOW = 1_800_000_000;

	private ResponseRepository $responses;
	private Poll $poll;
	private Poll $otherPoll;

	protected function setUp(): void
	{
		$pdo = TestDatabase::migrated();
		$polls = new PollRepository($pdo);
		$this->responses = new ResponseRepository($pdo);
		$this->poll = Fixtures::poll();
		$this->otherPoll = Fixtures::poll();
		$polls->insert($this->poll);
		$polls->insert($this->otherPoll);
	}

	protected function tearDown(): void
	{
		unset($this->responses);
	}

	public function testInsertedResponseIsFoundWithAllFields(): void
	{
		$response = Fixtures::response($this->poll->id, createdAt: self::NOW, updatedAt: self::NOW + 5);
		$this->responses->insert($response);

		self::assertEquals($response, $this->responses->find($this->poll->id, $response->id));
	}

	public function testResponseIsNotFoundThroughAnotherPoll(): void
	{
		$response = Fixtures::response($this->poll->id);
		$this->responses->insert($response);

		self::assertNull($this->responses->find($this->otherPoll->id, $response->id));
		self::assertNull($this->responses->find($this->poll->id, str_repeat('0', 32)));
	}

	public function testListIsOrderedByCreationTimeAndExcludesOtherPolls(): void
	{
		$second = Fixtures::response($this->poll->id, createdAt: self::NOW + 20);
		$first = Fixtures::response($this->poll->id, createdAt: self::NOW + 10, updatedAt: self::NOW + 30);
		$third = Fixtures::response($this->poll->id, createdAt: self::NOW + 30);
		$this->responses->insert($second);
		$this->responses->insert(Fixtures::response($this->otherPoll->id, createdAt: self::NOW + 15));
		$this->responses->insert($third);
		$this->responses->insert($first);

		self::assertEquals([$first, $second, $third], $this->responses->listForPoll($this->poll->id));
	}

	public function testResponsesFromTheSameSecondAreOrderedById(): void
	{
		$b = Fixtures::response($this->poll->id, id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
		$a = Fixtures::response($this->poll->id, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
		$c = Fixtures::response($this->poll->id, id: 'cccccccccccccccccccccccccccccccc');
		$this->responses->insert($b);
		$this->responses->insert($c);
		$this->responses->insert($a);

		self::assertEquals([$a, $b, $c], $this->responses->listForPoll($this->poll->id));
	}

	public function testListOfPollWithoutResponsesIsEmpty(): void
	{
		self::assertSame([], $this->responses->listForPoll($this->poll->id));
	}

	public function testCountsOnlyThePollsOwnResponses(): void
	{
		$this->responses->insert(Fixtures::response($this->poll->id));
		$this->responses->insert(Fixtures::response($this->poll->id));
		$this->responses->insert(Fixtures::response($this->otherPoll->id));

		self::assertSame(2, $this->responses->countForPoll($this->poll->id));
		self::assertSame(1, $this->responses->countForPoll($this->otherPoll->id));
		self::assertSame(0, $this->responses->countForPoll(str_repeat('0', 32)));
	}

	public function testUpdateWritesCiphertextAndUpdatedAt(): void
	{
		$response = Fixtures::response($this->poll->id, editToken: 'original', createdAt: self::NOW);
		$this->responses->insert($response);

		$this->responses->update(new PollResponse(
			id: $response->id,
			pollId: $response->pollId,
			editTokenHash: Fixtures::response($this->poll->id, editToken: 'replaced')->editTokenHash,
			ciphertext: Fixtures::ciphertext('X'),
			createdAt: self::NOW + 1000,
			updatedAt: self::NOW + 10,
		));

		self::assertEquals(
			new PollResponse($response->id, $response->pollId, $response->editTokenHash, Fixtures::ciphertext('X'), self::NOW, self::NOW + 10),
			$this->responses->find($this->poll->id, $response->id),
		);
	}

	public function testUpdateThroughAnotherPollChangesNothing(): void
	{
		$response = Fixtures::response($this->poll->id);
		$this->responses->insert($response);

		$this->responses->update(new PollResponse($response->id, $this->otherPoll->id, $response->editTokenHash, Fixtures::ciphertext('X'), 0, self::NOW + 10));

		self::assertEquals($response, $this->responses->find($this->poll->id, $response->id));
	}

	public function testDeleteRemovesOnlyThatResponse(): void
	{
		$deleted = Fixtures::response($this->poll->id);
		$kept = Fixtures::response($this->poll->id);
		$this->responses->insert($deleted);
		$this->responses->insert($kept);

		$this->responses->delete($this->otherPoll->id, $deleted->id);
		self::assertNotNull($this->responses->find($this->poll->id, $deleted->id), 'the wrong poll ID deletes nothing');

		$this->responses->delete($this->poll->id, $deleted->id);
		self::assertEquals([$kept], $this->responses->listForPoll($this->poll->id));
	}
}
