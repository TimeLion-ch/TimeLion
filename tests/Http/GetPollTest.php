<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class GetPollTest extends AppTestCase
{
	public function testReturnsPollWithResponsesOldestFirst(): void
	{
		$now = $this->clock->now();
		$poll = Fixtures::poll(createdAt: $now - 100, updatedAt: $now - 50, expiresAt: $now + 3600, closedAt: $now - 10);
		$this->polls()->insert($poll);
		$later = Fixtures::response($poll->id, ciphertext: Fixtures::ciphertext('L'), createdAt: $now - 20, updatedAt: $now - 5);
		$earlier = Fixtures::response($poll->id, ciphertext: Fixtures::ciphertext('E'), createdAt: $now - 40);
		$this->responses()->insert($later);
		$this->responses()->insert($earlier);

		$response = $this->request('GET', '/api/polls/' . $poll->id);

		self::assertSame(200, $response->getStatusCode());
		self::assertSame([
			'id' => $poll->id,
			'ciphertext' => $poll->ciphertext,
			'createdAt' => $now - 100,
			'updatedAt' => $now - 50,
			'expiresAt' => $now + 3600,
			'closedAt' => $now - 10,
			'responses' => [
				['id' => $earlier->id, 'ciphertext' => $earlier->ciphertext, 'createdAt' => $now - 40, 'updatedAt' => $now - 40],
				['id' => $later->id, 'ciphertext' => $later->ciphertext, 'createdAt' => $now - 20, 'updatedAt' => $now - 5],
			],
		], self::json($response));
	}

	public function testOpenPollWithoutResponses(): void
	{
		$poll = Fixtures::poll();
		$this->polls()->insert($poll);

		$response = $this->request('GET', '/api/polls/' . $poll->id);

		self::assertSame(200, $response->getStatusCode());
		self::assertStringContainsString('"closedAt":null,"responses":[]', (string) $response->getBody());
	}

	public function testResponsesOfOtherPollsDoNotLeakIn(): void
	{
		$poll = Fixtures::poll();
		$other = Fixtures::poll();
		$this->polls()->insert($poll);
		$this->polls()->insert($other);
		$own = Fixtures::response($poll->id);
		$this->responses()->insert($own);
		$this->responses()->insert(Fixtures::response($other->id));
		$this->responses()->insert(Fixtures::response($other->id));

		$responses = self::json($this->request('GET', '/api/polls/' . $poll->id))['responses'] ?? null;

		self::assertIsArray($responses);
		self::assertSame([$own->id], array_column($responses, 'id'));
	}

	public function testNeverExposesTokenHashes(): void
	{
		$poll = Fixtures::poll();
		$this->polls()->insert($poll);
		$response = Fixtures::response($poll->id);
		$this->responses()->insert($response);

		$body = (string) $this->request('GET', '/api/polls/' . $poll->id)->getBody();

		self::assertStringNotContainsString($poll->adminTokenHash, $body);
		self::assertStringNotContainsString($response->editTokenHash, $body);
		self::assertStringNotContainsStringIgnoringCase('hash', $body);
	}

	public function testPollIsGoneFromItsExpiryTime(): void
	{
		$poll = Fixtures::poll(expiresAt: $this->clock->now() + 60);
		$this->polls()->insert($poll);

		$this->clock->advance(59);
		self::assertSame(200, $this->request('GET', '/api/polls/' . $poll->id)->getStatusCode());

		$this->clock->advance(1);
		self::assertSame(self::notFoundBody(), $this->notFound('/api/polls/' . $poll->id));
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function missingPolls(): iterable
	{
		yield 'unknown' => [str_repeat('0', 32)];
		yield 'uppercase hex' => [strtoupper(str_repeat('ab', 16))];
		yield 'too short' => [str_repeat('a', 31)];
		yield 'too long' => [str_repeat('a', 33)];
		yield 'not hex' => [str_repeat('g', 32)];
		yield 'trailing newline' => [str_repeat('a', 32) . '%0A'];
		yield 'encoded slash' => [str_repeat('a', 16) . '%2F' . str_repeat('a', 16)];
		yield 'sql' => ["'%20OR%20'1'='1"];
	}

	#[DataProvider('missingPolls')]
	public function testUnknownMalformedAndExpiredLookTheSame(string $id): void
	{
		$this->polls()->insert(Fixtures::poll(id: str_repeat('a', 32)));

		self::assertSame(self::notFoundBody(), $this->notFound('/api/polls/' . $id));
	}

	public function testMalformedIdNeverReachesTheDatabase(): void
	{
		// Without the tables, any query would fail with a 500.
		$this->pdo->exec('DROP TABLE responses');
		$this->pdo->exec('DROP TABLE polls');

		self::assertSame(self::notFoundBody(), $this->notFound('/api/polls/' . str_repeat('g', 32)));
	}

	private function notFound(string $path): string
	{
		$response = $this->request('GET', $path);
		self::assertError(404, 'not_found', $response);

		return (string) $response->getBody();
	}

	private static function notFoundBody(): string
	{
		return '{"error":{"code":"not_found","message":"Not found."}}';
	}
}
