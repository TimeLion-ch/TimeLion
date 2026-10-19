<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Security\Random;
use TimeLion\Tests\AppTestCase;

final class DeleteResponseTest extends AppTestCase
{
	private string $pollId;
	private string $adminToken;
	private string $responseId;
	private string $editToken;
	private string $otherResponseId;

	protected function setUp(): void
	{
		parent::setUp();
		['id' => $this->pollId, 'adminToken' => $this->adminToken] = $this->newPoll();
		['id' => $this->responseId, 'editToken' => $this->editToken] = $this->newResponse($this->pollId);
		$this->otherResponseId = $this->newResponse($this->pollId)['id'];
	}

	public function testEditTokenDeletesTheResponse(): void
	{
		$response = $this->delete($this->editToken);

		self::assertSame(204, $response->getStatusCode());
		self::assertSame('', (string) $response->getBody());
		$this->assertOnlyTheOtherResponseIsLeft();
	}

	public function testAdminTokenDeletesTheResponse(): void
	{
		self::assertSame(204, $this->delete($this->adminToken)->getStatusCode());
		$this->assertOnlyTheOtherResponseIsLeft();
	}

	public function testDeletingIsAllowedOnClosedPolls(): void
	{
		$this->requestJson('PATCH', '/api/polls/' . $this->pollId, ['closed' => true], self::bearer($this->adminToken));

		self::assertSame(204, $this->delete($this->editToken)->getStatusCode());
		self::assertSame(204, $this->delete($this->adminToken, $this->otherResponseId)->getStatusCode());
	}

	public function testDeletedResponseIsGone(): void
	{
		$this->delete($this->editToken);

		self::assertError(404, 'not_found', $this->delete($this->editToken));
		self::assertError(404, 'not_found', $this->requestJson('PUT', $this->path(), ['ciphertext' => 'x'], self::bearer($this->editToken)));
	}

	/**
	 * @return iterable<string, array{array<string, string>}>
	 */
	public static function missingOrMalformedTokens(): iterable
	{
		yield 'no header' => [[]];
		yield 'empty bearer' => [['Authorization' => 'Bearer ']];
		yield 'basic auth' => [['Authorization' => 'Basic dXNlcjpwYXNz']];
	}

	/**
	 * @param array<string, string> $headers
	 */
	#[DataProvider('missingOrMalformedTokens')]
	public function testMissingOrMalformedTokenIs401(array $headers): void
	{
		self::assertError(401, 'unauthorized', $this->request('DELETE', $this->path(), null, $headers));
		self::assertSame(2, $this->responses()->countForPoll($this->pollId));
	}

	public function testWrongTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->delete(Random::token()));
		self::assertSame(2, $this->responses()->countForPoll($this->pollId));
	}

	public function testAnotherResponsesEditTokenIs403(): void
	{
		$other = $this->newResponse($this->pollId);

		self::assertError(403, 'forbidden', $this->delete($other['editToken']));
	}

	public function testAnotherPollsAdminTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->delete($this->newPoll()['adminToken']));
	}

	public function testResponseOfAnotherPollIs404EvenWithItsTokens(): void
	{
		$otherPoll = $this->newPoll();
		$foreign = $this->newResponse($otherPoll['id']);
		$path = '/api/polls/' . $this->pollId . '/responses/' . $foreign['id'];

		self::assertError(404, 'not_found', $this->request('DELETE', $path, null, self::bearer($foreign['editToken'])));
		self::assertError(404, 'not_found', $this->request('DELETE', $path, null, self::bearer($this->adminToken)));
		self::assertSame(1, $this->responses()->countForPoll($otherPoll['id']));
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function missingResponses(): iterable
	{
		yield 'unknown' => [str_repeat('0', 32)];
		yield 'malformed' => [str_repeat('0', 31)];
	}

	#[DataProvider('missingResponses')]
	public function testUnknownOrMalformedResponseIs404(string $responseId): void
	{
		self::assertError(404, 'not_found', $this->delete($this->adminToken, $responseId));
	}

	public function testExpiredPollIs404(): void
	{
		$this->clock->advance(7 * 86400);

		self::assertError(404, 'not_found', $this->delete($this->editToken));
	}

	private function assertOnlyTheOtherResponseIsLeft(): void
	{
		$responses = $this->responses()->listForPoll($this->pollId);

		self::assertCount(1, $responses);
		self::assertSame($this->otherResponseId, $responses[0]->id);
	}

	private function delete(string $token, ?string $responseId = null): ResponseInterface
	{
		return $this->request('DELETE', $this->path($responseId), null, self::bearer($token));
	}

	private function path(?string $responseId = null): string
	{
		return '/api/polls/' . $this->pollId . '/responses/' . ($responseId ?? $this->responseId);
	}
}
