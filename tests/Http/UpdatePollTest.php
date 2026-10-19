<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Polls\Limits;
use TimeLion\Polls\Poll;
use TimeLion\Security\Random;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class UpdatePollTest extends AppTestCase
{
	private string $id;
	private string $adminToken;
	private Poll $original;

	protected function setUp(): void
	{
		parent::setUp();
		['id' => $this->id, 'adminToken' => $this->adminToken] = $this->newPoll();
		$this->original = $this->stored();
		$this->clock->advance(100);
	}

	public function testReplacesCiphertext(): void
	{
		$response = $this->patch(['ciphertext' => Fixtures::ciphertext('N', 40)]);

		self::assertSame(200, $response->getStatusCode());
		self::assertSame([
			'id' => $this->id,
			'updatedAt' => $this->clock->now(),
			'expiresAt' => $this->original->expiresAt,
			'closedAt' => null,
		], self::json($response));
		self::assertEquals(
			new Poll($this->id, $this->original->adminTokenHash, Fixtures::ciphertext('N', 40), $this->original->createdAt, $this->clock->now(), $this->original->expiresAt, null),
			$this->stored(),
		);
	}

	public function testMovesExpiry(): void
	{
		$expiresAt = $this->clock->now() + Limits::MAX_LIFETIME;

		$response = $this->patch(['expiresAt' => $expiresAt]);

		self::assertSame($expiresAt, self::json($response)['expiresAt'] ?? null);
		self::assertSame($expiresAt, $this->stored()->expiresAt);
		self::assertSame($this->original->ciphertext, $this->stored()->ciphertext);
	}

	public function testExpiryCanBeShortened(): void
	{
		$this->patch(['expiresAt' => $this->clock->now() + 1]);
		$this->clock->advance(1);

		self::assertError(404, 'not_found', $this->request('GET', '/api/polls/' . $this->id));
	}

	public function testClosesAndReopens(): void
	{
		$closedAt = $this->clock->now();

		self::assertSame($closedAt, self::json($this->patch(['closed' => true]))['closedAt'] ?? null);
		self::assertSame($closedAt, $this->stored()->closedAt);

		$this->clock->advance(50);
		self::assertSame($closedAt, self::json($this->patch(['closed' => true]))['closedAt'] ?? null, 'closing again keeps the first time');

		$response = $this->patch(['closed' => false]);
		self::assertArrayHasKey('closedAt', self::json($response));
		self::assertNull(self::json($response)['closedAt']);
		self::assertNull($this->stored()->closedAt);
	}

	public function testAppliesAllFieldsTogether(): void
	{
		$expiresAt = $this->clock->now() + 86400;

		$response = $this->patch(['ciphertext' => Fixtures::ciphertext('N'), 'expiresAt' => $expiresAt, 'closed' => true]);

		self::assertSame(['id' => $this->id, 'updatedAt' => $this->clock->now(), 'expiresAt' => $expiresAt, 'closedAt' => $this->clock->now()], self::json($response));
		self::assertEquals(
			new Poll($this->id, $this->original->adminTokenHash, Fixtures::ciphertext('N'), $this->original->createdAt, $this->clock->now(), $expiresAt, $this->clock->now()),
			$this->stored(),
		);
	}

	public function testClosedPollCanStillBeEdited(): void
	{
		$this->patch(['closed' => true]);

		self::assertSame(200, $this->patch(['ciphertext' => Fixtures::ciphertext('N')])->getStatusCode());
		self::assertNotNull($this->stored()->closedAt);
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function emptyPatches(): iterable
	{
		yield 'empty object' => ['{}'];
		yield 'only unknown fields' => ['{"title":"x","closedAt":1}'];
	}

	#[DataProvider('emptyPatches')]
	public function testRejectsEmptyPatch(string $body): void
	{
		self::assertError(400, 'empty_patch', $this->request('PATCH', '/api/polls/' . $this->id, $body, self::bearer($this->adminToken)));
		self::assertEquals($this->original, $this->stored());
	}

	/**
	 * @return iterable<string, array{array<string, mixed>, string}>
	 */
	public static function invalidPatches(): iterable
	{
		$now = 1_800_000_100; // FrozenClock's default, advanced in setUp()
		$tooLarge = Fixtures::ciphertext('N', Limits::MAX_POLL_CIPHERTEXT_BYTES + 1 - strlen(Fixtures::ciphertext('N', 0)));

		yield 'ciphertext null' => [['ciphertext' => null], 'invalid_ciphertext'];
		yield 'ciphertext malformed' => [['ciphertext' => 'v1.short'], 'invalid_ciphertext'];
		yield 'ciphertext too large' => [['ciphertext' => $tooLarge], 'ciphertext_too_large'];
		yield 'expiresAt null' => [['expiresAt' => null], 'invalid_expiry'];
		yield 'expiresAt in the past' => [['expiresAt' => $now], 'invalid_expiry'];
		yield 'expiresAt too far' => [['expiresAt' => $now + Limits::MAX_LIFETIME + 1], 'invalid_expiry'];
		yield 'closed as string' => [['closed' => 'true'], 'invalid_field'];
		yield 'closed as integer' => [['closed' => 1], 'invalid_field'];
		yield 'closed null' => [['closed' => null], 'invalid_field'];
		yield 'valid ciphertext, invalid closed' => [['ciphertext' => Fixtures::ciphertext('N'), 'closed' => 'yes'], 'invalid_field'];
		yield 'valid closed, invalid expiry' => [['closed' => true, 'expiresAt' => 'never'], 'invalid_expiry'];
	}

	/**
	 * @param array<string, mixed> $fields
	 */
	#[DataProvider('invalidPatches')]
	public function testRejectsInvalidFieldsAndChangesNothing(array $fields, string $code): void
	{
		self::assertError(400, $code, $this->patch($fields));
		self::assertEquals($this->original, $this->stored());
	}

	public function testRejectsOversizedBody(): void
	{
		$response = $this->patch(['closed' => true, 'padding' => str_repeat('x', Limits::MAX_BODY_BYTES)]);

		self::assertError(413, 'payload_too_large', $response);
		self::assertEquals($this->original, $this->stored());
	}

	public function testRejectsWrongContentType(): void
	{
		$response = $this->request('PATCH', '/api/polls/' . $this->id, '{"closed":true}', self::bearer($this->adminToken) + ['Content-Type' => 'text/plain']);

		self::assertError(415, 'unsupported_media_type', $response);
	}

	/**
	 * @return iterable<string, array{array<string, string>}>
	 */
	public static function missingOrMalformedTokens(): iterable
	{
		yield 'no header' => [[]];
		yield 'basic auth' => [['Authorization' => 'Basic ' . base64_encode('admin:secret')]];
		yield 'too short' => [['Authorization' => 'Bearer abc']];
		yield 'token in another header' => [['X-Admin-Token' => Random::token()]];
	}

	/**
	 * @param array<string, string> $headers
	 */
	#[DataProvider('missingOrMalformedTokens')]
	public function testMissingOrMalformedTokenIs401(array $headers): void
	{
		self::assertError(401, 'unauthorized', $this->request('PATCH', '/api/polls/' . $this->id, '{"closed":true}', $headers));
		self::assertEquals($this->original, $this->stored());
	}

	public function testMissingTokenIs401EvenForUnknownPolls(): void
	{
		self::assertError(401, 'unauthorized', $this->request('PATCH', '/api/polls/' . str_repeat('0', 32), '{"closed":true}'));
	}

	public function testWrongTokenIs403(): void
	{
		self::assertError(403, 'forbidden', $this->patch(['closed' => true], Random::token()));
		self::assertEquals($this->original, $this->stored());
	}

	public function testAnotherPollsAdminTokenIs403(): void
	{
		$other = $this->newPoll();

		self::assertError(403, 'forbidden', $this->patch(['closed' => true], $other['adminToken']));
	}

	public function testWrongTokenIs403BeforeTheBodyIsChecked(): void
	{
		self::assertError(403, 'forbidden', $this->request('PATCH', '/api/polls/' . $this->id, 'not json', self::bearer(Random::token())));
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function missingPolls(): iterable
	{
		yield 'unknown' => [str_repeat('0', 32)];
		yield 'malformed' => [str_repeat('Z', 32)];
	}

	#[DataProvider('missingPolls')]
	public function testUnknownOrMalformedPollIs404(string $id): void
	{
		self::assertError(404, 'not_found', $this->request('PATCH', '/api/polls/' . $id, '{"closed":true}', self::bearer($this->adminToken)));
	}

	public function testExpiredPollIs404EvenWithTheRightToken(): void
	{
		$this->clock->advance($this->original->expiresAt - $this->clock->now());

		self::assertError(404, 'not_found', $this->patch(['expiresAt' => $this->clock->now() + 86400]));
	}

	/**
	 * @param array<string, mixed> $fields
	 */
	private function patch(array $fields, ?string $token = null): ResponseInterface
	{
		return $this->requestJson('PATCH', '/api/polls/' . $this->id, $fields, self::bearer($token ?? $this->adminToken));
	}

	private function stored(): Poll
	{
		$poll = $this->polls()->findActive($this->id, 0);
		self::assertNotNull($poll);

		return $poll;
	}
}
