<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Polls\Limits;
use TimeLion\Polls\PollResponse;
use TimeLion\Security\TokenHash;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class CreateResponseTest extends AppTestCase
{
	private string $pollId;
	private string $adminToken;

	protected function setUp(): void
	{
		parent::setUp();
		['id' => $this->pollId, 'adminToken' => $this->adminToken] = $this->newPoll();
		$this->clock->advance(10);
	}

	public function testAddsResponse(): void
	{
		$ciphertext = Fixtures::ciphertext('V', 100);

		$response = $this->post(['ciphertext' => $ciphertext]);

		self::assertSame(201, $response->getStatusCode());
		$data = self::json($response);
		self::assertSame(['id', 'editToken', 'createdAt'], array_keys($data));
		self::assertIsString($data['id']);
		self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/D', $data['id']);
		self::assertIsString($data['editToken']);
		self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $data['editToken']);
		self::assertSame($this->clock->now(), $data['createdAt']);
		self::assertEquals(
			new PollResponse($data['id'], $this->pollId, TokenHash::hash($data['editToken']), $ciphertext, $this->clock->now(), $this->clock->now()),
			$this->responses()->find($this->pollId, $data['id']),
		);
	}

	public function testResponseShowsUpInThePoll(): void
	{
		$first = $this->newResponse($this->pollId, Fixtures::ciphertext('A'));
		$this->clock->advance(1);
		$second = $this->newResponse($this->pollId, Fixtures::ciphertext('B'));

		$responses = self::json($this->request('GET', '/api/polls/' . $this->pollId))['responses'] ?? null;

		self::assertIsArray($responses);
		self::assertSame([$first['id'], $second['id']], array_column($responses, 'id'));
		self::assertSame([Fixtures::ciphertext('A'), Fixtures::ciphertext('B')], array_column($responses, 'ciphertext'));
	}

	public function testStoresOnlyTheHashOfTheEditToken(): void
	{
		$created = $this->newResponse($this->pollId);

		$statement = $this->pdo->query('SELECT * FROM responses');
		self::assertNotFalse($statement);
		self::assertStringNotContainsString($created['editToken'], json_encode($statement->fetchAll(), JSON_THROW_ON_ERROR));
	}

	public function testAcceptsTheLargestAllowedCiphertext(): void
	{
		$ciphertext = Fixtures::ciphertext('V', Limits::MAX_RESPONSE_CIPHERTEXT_BYTES - strlen(Fixtures::ciphertext('V', 0)));

		self::assertSame(201, $this->post(['ciphertext' => $ciphertext])->getStatusCode());
	}

	/**
	 * @return iterable<string, array{mixed, string}>
	 */
	public static function invalidCiphertexts(): iterable
	{
		yield 'missing' => [null, 'invalid_ciphertext'];
		yield 'not a string' => [['votes' => 'yes'], 'invalid_ciphertext'];
		yield 'plaintext' => ['Alice: yes', 'invalid_ciphertext'];
		yield 'one byte too large' => [
			Fixtures::ciphertext('V', Limits::MAX_RESPONSE_CIPHERTEXT_BYTES + 1 - strlen(Fixtures::ciphertext('V', 0))),
			'ciphertext_too_large',
		];
	}

	#[DataProvider('invalidCiphertexts')]
	public function testRejectsInvalidCiphertext(mixed $ciphertext, string $code): void
	{
		self::assertError(400, $code, $this->post(['ciphertext' => $ciphertext]));
		self::assertSame(0, $this->responses()->countForPoll($this->pollId));
	}

	public function testRejectsMalformedJson(): void
	{
		self::assertError(400, 'invalid_json', $this->request('POST', $this->path(), '{"ciphertext"'));
	}

	public function testRejectsOversizedBody(): void
	{
		self::assertError(413, 'payload_too_large', $this->post(['ciphertext' => Fixtures::ciphertext('V'), 'padding' => str_repeat('x', Limits::MAX_BODY_BYTES)]));
	}

	public function testRejectsWrongContentType(): void
	{
		$response = $this->request('POST', $this->path(), '{"ciphertext":"' . Fixtures::ciphertext('V') . '"}', ['Content-Type' => 'application/x-www-form-urlencoded']);

		self::assertError(415, 'unsupported_media_type', $response);
	}

	public function testClosedPollTakesNoResponses(): void
	{
		$this->requestJson('PATCH', '/api/polls/' . $this->pollId, ['closed' => true], self::bearer($this->adminToken));

		self::assertError(409, 'poll_closed', $this->post(['ciphertext' => Fixtures::ciphertext('V')]));
		self::assertSame(0, $this->responses()->countForPoll($this->pollId));

		$this->requestJson('PATCH', '/api/polls/' . $this->pollId, ['closed' => false], self::bearer($this->adminToken));
		self::assertSame(201, $this->post(['ciphertext' => Fixtures::ciphertext('V')])->getStatusCode(), 'a reopened poll takes responses again');
	}

	public function testBodyIsValidatedBeforeThePollState(): void
	{
		$this->requestJson('PATCH', '/api/polls/' . $this->pollId, ['closed' => true], self::bearer($this->adminToken));

		self::assertError(400, 'invalid_ciphertext', $this->post(['ciphertext' => 'nope']));
	}

	public function testStopsAtTheResponseLimit(): void
	{
		$this->pdo->beginTransaction();
		for ($i = 1; $i < Limits::MAX_RESPONSES_PER_POLL; $i++) {
			$this->responses()->insert(Fixtures::response($this->pollId));
		}
		$this->pdo->commit();

		self::assertSame(201, $this->post(['ciphertext' => Fixtures::ciphertext('V')])->getStatusCode(), 'the last allowed response');
		self::assertError(409, 'too_many_responses', $this->post(['ciphertext' => Fixtures::ciphertext('V')]));
		self::assertSame(Limits::MAX_RESPONSES_PER_POLL, $this->responses()->countForPoll($this->pollId));

		$other = $this->newPoll();
		self::assertSame(201, $this->requestJson('POST', '/api/polls/' . $other['id'] . '/responses', ['ciphertext' => Fixtures::ciphertext('V')])->getStatusCode(), 'the limit is per poll');
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function missingPolls(): iterable
	{
		yield 'unknown' => [str_repeat('0', 32)];
		yield 'malformed' => [str_repeat('X', 32)];
	}

	#[DataProvider('missingPolls')]
	public function testUnknownOrMalformedPollIs404(string $id): void
	{
		self::assertError(404, 'not_found', $this->requestJson('POST', '/api/polls/' . $id . '/responses', ['ciphertext' => Fixtures::ciphertext('V')]));
	}

	public function testExpiredPollIs404(): void
	{
		$this->clock->advance(7 * 86400);

		self::assertError(404, 'not_found', $this->post(['ciphertext' => Fixtures::ciphertext('V')]));
	}

	/**
	 * @param array<string, mixed> $fields
	 */
	private function post(array $fields): ResponseInterface
	{
		return $this->requestJson('POST', $this->path(), $fields);
	}

	private function path(): string
	{
		return '/api/polls/' . $this->pollId . '/responses';
	}
}
