<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Polls\Limits;
use TimeLion\Polls\PollResponse;
use TimeLion\Security\Random;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class UpdateResponseTest extends AppTestCase
{
	private string $pollId;
	private string $adminToken;
	private string $responseId;
	private string $editToken;
	private PollResponse $original;

	protected function setUp(): void
	{
		parent::setUp();
		['id' => $this->pollId, 'adminToken' => $this->adminToken] = $this->newPoll();
		['id' => $this->responseId, 'editToken' => $this->editToken] = $this->newResponse($this->pollId);
		$this->original = $this->stored();
		$this->clock->advance(60);
	}

	public function testReplacesCiphertext(): void
	{
		$response = $this->put(['ciphertext' => Fixtures::ciphertext('U', 50)]);

		self::assertSame(200, $response->getStatusCode());
		self::assertSame(['id' => $this->responseId, 'updatedAt' => $this->clock->now()], self::json($response));
		self::assertEquals(
			new PollResponse($this->responseId, $this->pollId, $this->original->editTokenHash, Fixtures::ciphertext('U', 50), $this->original->createdAt, $this->clock->now()),
			$this->stored(),
		);
	}

	public function testLeavesOtherResponsesAlone(): void
	{
		$other = $this->newResponse($this->pollId, Fixtures::ciphertext('O'));

		$this->put(['ciphertext' => Fixtures::ciphertext('U')]);

		self::assertSame(Fixtures::ciphertext('O'), $this->responses()->find($this->pollId, $other['id'])?->ciphertext);
	}

	/**
	 * @return iterable<string, array{mixed, string}>
	 */
	public static function invalidCiphertexts(): iterable
	{
		yield 'missing' => [null, 'invalid_ciphertext'];
		yield 'malformed' => ['v1..', 'invalid_ciphertext'];
		yield 'one byte too large' => [
			Fixtures::ciphertext('U', Limits::MAX_RESPONSE_CIPHERTEXT_BYTES + 1 - strlen(Fixtures::ciphertext('U', 0))),
			'ciphertext_too_large',
		];
	}

	#[DataProvider('invalidCiphertexts')]
	public function testRejectsInvalidCiphertext(mixed $ciphertext, string $code): void
	{
		self::assertError(400, $code, $this->put(['ciphertext' => $ciphertext]));
		self::assertEquals($this->original, $this->stored());
	}

	public function testRejectsOversizedBodyAndWrongContentType(): void
	{
		self::assertError(413, 'payload_too_large', $this->put(['ciphertext' => Fixtures::ciphertext('U'), 'padding' => str_repeat('x', Limits::MAX_BODY_BYTES)]));
		self::assertError(415, 'unsupported_media_type', $this->request('PUT', $this->path(), '{}', self::bearer($this->editToken) + ['Content-Type' => 'text/plain']));
	}

	public function testClosedPollIs409(): void
	{
		$this->requestJson('PATCH', '/api/polls/' . $this->pollId, ['closed' => true], self::bearer($this->adminToken));

		self::assertError(409, 'poll_closed', $this->put(['ciphertext' => Fixtures::ciphertext('U')]));
		self::assertEquals($this->original, $this->stored());
	}

	/**
	 * @return iterable<string, array{array<string, string>}>
	 */
	public static function missingOrMalformedTokens(): iterable
	{
		yield 'no header' => [[]];
		yield 'basic auth' => [['Authorization' => 'Basic dXNlcjpwYXNz']];
		yield 'wrong length' => [['Authorization' => 'Bearer ' . substr(Random::token(), 0, 42)]];
	}

	/**
	 * @param array<string, string> $headers
	 */
	#[DataProvider('missingOrMalformedTokens')]
	public function testMissingOrMalformedTokenIs401(array $headers): void
	{
		self::assertError(401, 'unauthorized', $this->request('PUT', $this->path(), '{"ciphertext":"' . Fixtures::ciphertext('U') . '"}', $headers));
	}

	public function testWrongTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->put(['ciphertext' => Fixtures::ciphertext('U')], Random::token()));
		self::assertEquals($this->original, $this->stored());
	}

	public function testAdminTokenCannotEditResponses(): void
	{
		self::assertError(403, 'forbidden', $this->put(['ciphertext' => Fixtures::ciphertext('U')], $this->adminToken));
	}

	public function testAnotherResponsesEditTokenIs403(): void
	{
		$other = $this->newResponse($this->pollId);

		self::assertError(403, 'forbidden', $this->put(['ciphertext' => Fixtures::ciphertext('U')], $other['editToken']));
	}

	public function testResponseOfAnotherPollIs404(): void
	{
		$otherPoll = $this->newPoll();
		$foreign = $this->newResponse($otherPoll['id']);

		// The right edit token, but the response belongs to another poll.
		$response = $this->requestJson('PUT', '/api/polls/' . $this->pollId . '/responses/' . $foreign['id'], ['ciphertext' => Fixtures::ciphertext('U')], self::bearer($foreign['editToken']));

		self::assertError(404, 'not_found', $response);
		self::assertSame(Fixtures::ciphertext('R'), $this->responses()->find($otherPoll['id'], $foreign['id'])?->ciphertext);
	}

	/**
	 * @return iterable<string, array{string, string}>
	 */
	public static function missingTargets(): iterable
	{
		yield 'unknown response' => ['{poll}', str_repeat('0', 32)];
		yield 'malformed response ID' => ['{poll}', 'response'];
		yield 'unknown poll' => [str_repeat('0', 32), '{response}'];
		yield 'malformed poll ID' => ['POLL', '{response}'];
	}

	#[DataProvider('missingTargets')]
	public function testUnknownOrMalformedIdsAre404(string $pollId, string $responseId): void
	{
		$path = '/api/polls/' . str_replace('{poll}', $this->pollId, $pollId) . '/responses/' . str_replace('{response}', $this->responseId, $responseId);

		self::assertError(404, 'not_found', $this->requestJson('PUT', $path, ['ciphertext' => Fixtures::ciphertext('U')], self::bearer($this->editToken)));
	}

	public function testExpiredPollIs404(): void
	{
		$this->clock->advance(7 * 86400);

		self::assertError(404, 'not_found', $this->put(['ciphertext' => Fixtures::ciphertext('U')]));
	}

	/**
	 * @param array<string, mixed> $fields
	 */
	private function put(array $fields, ?string $token = null): ResponseInterface
	{
		return $this->requestJson('PUT', $this->path(), $fields, self::bearer($token ?? $this->editToken));
	}

	private function path(): string
	{
		return '/api/polls/' . $this->pollId . '/responses/' . $this->responseId;
	}

	private function stored(): PollResponse
	{
		$response = $this->responses()->find($this->pollId, $this->responseId);
		self::assertNotNull($response);

		return $response;
	}
}
