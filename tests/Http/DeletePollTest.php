<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Security\Random;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class DeletePollTest extends AppTestCase
{
	private string $id;
	private string $adminToken;

	protected function setUp(): void
	{
		parent::setUp();
		['id' => $this->id, 'adminToken' => $this->adminToken] = $this->newPoll();
		$this->responses()->insert(Fixtures::response($this->id));
		$this->responses()->insert(Fixtures::response($this->id));
	}

	public function testDeletesPollAndItsResponses(): void
	{
		$other = $this->newPoll();
		$otherResponse = Fixtures::response($other['id']);
		$this->responses()->insert($otherResponse);

		$response = $this->delete($this->id, $this->adminToken);

		self::assertSame(204, $response->getStatusCode());
		self::assertSame('', (string) $response->getBody());
		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
		self::assertNull($this->polls()->findActive($this->id, 0));
		self::assertSame(0, $this->responses()->countForPoll($this->id));
		self::assertNotNull($this->polls()->findActive($other['id'], 0));
		self::assertEquals([$otherResponse], $this->responses()->listForPoll($other['id']));
	}

	public function testDeletedPollIsGone(): void
	{
		$this->delete($this->id, $this->adminToken);

		self::assertError(404, 'not_found', $this->request('GET', '/api/polls/' . $this->id));
		self::assertError(404, 'not_found', $this->delete($this->id, $this->adminToken));
	}

	public function testClosedPollCanBeDeleted(): void
	{
		$this->requestJson('PATCH', '/api/polls/' . $this->id, ['closed' => true], self::bearer($this->adminToken));

		self::assertSame(204, $this->delete($this->id, $this->adminToken)->getStatusCode());
	}

	/**
	 * @return iterable<string, array{array<string, string>}>
	 */
	public static function missingOrMalformedTokens(): iterable
	{
		yield 'no header' => [[]];
		yield 'basic auth' => [['Authorization' => 'Basic ' . base64_encode('admin:secret')]];
		yield 'too long' => [['Authorization' => 'Bearer ' . Random::token() . 'x']];
	}

	/**
	 * @param array<string, string> $headers
	 */
	#[DataProvider('missingOrMalformedTokens')]
	public function testMissingOrMalformedTokenIs401(array $headers): void
	{
		self::assertError(401, 'unauthorized', $this->request('DELETE', '/api/polls/' . $this->id, null, $headers));
		self::assertNotNull($this->polls()->findActive($this->id, 0));
	}

	public function testWrongTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->delete($this->id, Random::token()));
		self::assertNotNull($this->polls()->findActive($this->id, 0));
		self::assertSame(2, $this->responses()->countForPoll($this->id));
	}

	public function testAnotherPollsAdminTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->delete($this->id, $this->newPoll()['adminToken']));
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function missingPolls(): iterable
	{
		yield 'unknown' => [str_repeat('0', 32)];
		yield 'malformed' => ['not-a-poll'];
	}

	#[DataProvider('missingPolls')]
	public function testUnknownOrMalformedPollIs404(string $id): void
	{
		self::assertError(404, 'not_found', $this->delete($id, $this->adminToken));
	}

	public function testExpiredPollIs404(): void
	{
		$this->clock->advance(7 * 86400);

		self::assertError(404, 'not_found', $this->delete($this->id, $this->adminToken));
	}

	private function delete(string $id, string $token): ResponseInterface
	{
		return $this->request('DELETE', '/api/polls/' . $id, null, self::bearer($token));
	}
}
