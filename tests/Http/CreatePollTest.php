<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Polls\Limits;
use TimeLion\Security\TokenHash;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class CreatePollTest extends AppTestCase
{
	public function testCreatesPoll(): void
	{
		$now = $this->clock->now();
		$ciphertext = Fixtures::ciphertext('C', 200);

		$response = $this->requestJson('POST', '/api/polls', ['ciphertext' => $ciphertext, 'expiresAt' => $now + 86400]);

		self::assertSame(201, $response->getStatusCode());
		$data = self::json($response);
		self::assertSame(['id', 'adminToken', 'createdAt', 'expiresAt'], array_keys($data));
		self::assertIsString($data['id']);
		self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/D', $data['id']);
		self::assertIsString($data['adminToken']);
		self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $data['adminToken']);
		self::assertSame($now, $data['createdAt']);
		self::assertSame($now + 86400, $data['expiresAt']);

		self::assertSame([[
			'id' => $data['id'],
			'admin_token_hash' => TokenHash::hash($data['adminToken']),
			'ciphertext' => $ciphertext,
			'created_at' => $now,
			'updated_at' => $now,
			'expires_at' => $now + 86400,
			'closed_at' => null,
		]], $this->storedPolls());
	}

	public function testStoresOnlyTheHashOfTheAdminToken(): void
	{
		$data = self::json($this->createPoll());
		self::assertIsString($data['adminToken']);

		self::assertStringNotContainsString($data['adminToken'], json_encode($this->storedPolls(), JSON_THROW_ON_ERROR));
	}

	public function testEveryPollGetsItsOwnIdAndToken(): void
	{
		$first = self::json($this->createPoll());
		$second = self::json($this->createPoll());

		self::assertNotSame($first['id'], $second['id']);
		self::assertNotSame($first['adminToken'], $second['adminToken']);
	}

	public function testAcceptsTheLargestAllowedCiphertext(): void
	{
		$ciphertext = Fixtures::ciphertext('C', Limits::MAX_POLL_CIPHERTEXT_BYTES - strlen(Fixtures::ciphertext('C', 0)));
		self::assertSame(Limits::MAX_POLL_CIPHERTEXT_BYTES, strlen($ciphertext));

		$response = $this->createPoll(['ciphertext' => $ciphertext]);

		self::assertSame(201, $response->getStatusCode());
		self::assertSame($ciphertext, $this->storedPolls()[0]['ciphertext'] ?? null);
	}

	public function testAcceptsTheMaximumLifetime(): void
	{
		$expiresAt = $this->clock->now() + Limits::MAX_LIFETIME;

		self::assertSame($expiresAt, self::json($this->createPoll(['expiresAt' => $expiresAt]))['expiresAt']);
	}

	public function testIgnoresUnknownFields(): void
	{
		$response = $this->createPoll(['title' => 'plaintext must not be sent, but is not stored either']);

		self::assertSame(201, $response->getStatusCode());
		self::assertStringNotContainsString('plaintext', json_encode($this->storedPolls(), JSON_THROW_ON_ERROR));
	}

	/**
	 * @return iterable<string, array{array<string, mixed>, string}>
	 */
	public static function invalidFields(): iterable
	{
		$now = 1_800_000_000; // FrozenClock's default

		yield 'missing ciphertext' => [['ciphertext' => null], 'invalid_ciphertext'];
		yield 'ciphertext not a string' => [['ciphertext' => 123], 'invalid_ciphertext'];
		yield 'empty ciphertext' => [['ciphertext' => ''], 'invalid_ciphertext'];
		yield 'plaintext instead of ciphertext' => [['ciphertext' => 'Team dinner'], 'invalid_ciphertext'];
		yield 'ciphertext one byte too large' => [
			['ciphertext' => Fixtures::ciphertext('C', Limits::MAX_POLL_CIPHERTEXT_BYTES + 1 - strlen(Fixtures::ciphertext('C', 0)))],
			'ciphertext_too_large',
		];
		yield 'missing expiresAt' => [['expiresAt' => null], 'invalid_expiry'];
		yield 'expiresAt as string' => [['expiresAt' => (string) ($now + 60)], 'invalid_expiry'];
		yield 'expiresAt as float' => [['expiresAt' => $now + 60.5], 'invalid_expiry'];
		yield 'expiresAt now' => [['expiresAt' => $now], 'invalid_expiry'];
		yield 'expiresAt in the past' => [['expiresAt' => $now - 60], 'invalid_expiry'];
		yield 'expiresAt beyond the maximum lifetime' => [['expiresAt' => $now + Limits::MAX_LIFETIME + 1], 'invalid_expiry'];
	}

	/**
	 * @param array<string, mixed> $fields
	 */
	#[DataProvider('invalidFields')]
	public function testRejectsInvalidFields(array $fields, string $code): void
	{
		self::assertError(400, $code, $this->createPoll($fields));
		self::assertSame([], $this->storedPolls());
	}

	public function testRejectsEmptyObject(): void
	{
		self::assertError(400, 'invalid_ciphertext', $this->request('POST', '/api/polls', '{}'));
	}

	public function testRejectsOversizedBody(): void
	{
		$body = json_encode(['ciphertext' => Fixtures::ciphertext('C'), 'expiresAt' => $this->clock->now() + 60, 'padding' => str_repeat('x', Limits::MAX_BODY_BYTES)]);
		self::assertIsString($body);

		self::assertError(413, 'payload_too_large', $this->request('POST', '/api/polls', $body));
		self::assertSame([], $this->storedPolls());
	}

	public function testRejectsWrongContentType(): void
	{
		$body = json_encode(['ciphertext' => Fixtures::ciphertext('C'), 'expiresAt' => $this->clock->now() + 60]);
		self::assertIsString($body);

		$response = $this->request('POST', '/api/polls', $body, ['Content-Type' => 'text/plain']);

		self::assertError(415, 'unsupported_media_type', $response);
		self::assertSame([], $this->storedPolls());
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function malformedBodies(): iterable
	{
		yield 'not JSON' => ['ciphertext=v1.abc'];
		yield 'truncated' => ['{"ciphertext":'];
		yield 'array' => ['[]'];
		yield 'empty' => [''];
	}

	#[DataProvider('malformedBodies')]
	public function testRejectsMalformedJson(string $body): void
	{
		self::assertError(400, 'invalid_json', $this->request('POST', '/api/polls', $body));
	}

	public function testOtherMethodsAreNotAllowed(): void
	{
		$response = $this->request('GET', '/api/polls');

		self::assertError(405, 'method_not_allowed', $response);
		self::assertSame('POST', $response->getHeaderLine('Allow'));
	}

	/**
	 * @param array<string, mixed> $overrides
	 */
	private function createPoll(array $overrides = []): ResponseInterface
	{
		return $this->requestJson('POST', '/api/polls', $overrides + [
			'ciphertext' => Fixtures::ciphertext('C'),
			'expiresAt' => $this->clock->now() + 7 * 86400,
		]);
	}

	/**
	 * @return list<array<mixed>>
	 */
	private function storedPolls(): array
	{
		$statement = $this->pdo->query('SELECT id, admin_token_hash, ciphertext, created_at, updated_at, expires_at, closed_at FROM polls');
		self::assertNotFalse($statement);

		return array_values(array_filter($statement->fetchAll(PDO::FETCH_ASSOC), is_array(...)));
	}
}
