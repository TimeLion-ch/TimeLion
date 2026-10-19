<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PDO;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Security\Random;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

/**
 * Which endpoints count against which limit (the limiter itself: tests/Security/RateLimiterTest.php).
 */
final class RateLimitTest extends AppTestCase
{
	public function testCreatingPollsIsLimitedTo20PerHour(): void
	{
		for ($i = 0; $i < 20; $i++) {
			self::assertSame(201, $this->createPoll()->getStatusCode());
		}

		$response = $this->createPoll();

		self::assertError(429, 'too_many_requests', $response);
		self::assertMatchesRegularExpression('/^[1-9]\d*$/D', $response->getHeaderLine('Retry-After'));
		self::assertLessThanOrEqual(3600, (int) $response->getHeaderLine('Retry-After'));
		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
	}

	public function testLimitIsPerClientAndPerWindow(): void
	{
		for ($i = 0; $i < 20; $i++) {
			$this->createPoll();
		}
		self::assertSame(429, $this->createPoll()->getStatusCode());

		$this->clientIp = '198.51.100.23';
		self::assertSame(201, $this->createPoll()->getStatusCode(), 'another client');

		$this->clientIp = '192.0.2.1';
		$this->clock->advance(3600);
		self::assertSame(201, $this->createPoll()->getStatusCode(), 'the next window');
	}

	public function testResponseWritesShareOneLimitOf60(): void
	{
		$poll = $this->newPoll();
		$created = $this->newResponse($poll['id']);
		$path = '/api/polls/' . $poll['id'] . '/responses';
		for ($i = 0; $i < 29; $i++) {
			self::assertSame(201, $this->requestJson('POST', $path, ['ciphertext' => Fixtures::ciphertext('R')])->getStatusCode());
		}
		for ($i = 0; $i < 30; $i++) {
			self::assertSame(200, $this->requestJson('PUT', $path . '/' . $created['id'], ['ciphertext' => Fixtures::ciphertext('U')], self::bearer($created['editToken']))->getStatusCode());
		}

		self::assertError(429, 'too_many_requests', $this->request('DELETE', $path . '/' . $created['id'], null, self::bearer($created['editToken'])));
		self::assertSame(201, $this->createPoll()->getStatusCode(), 'creating polls has its own limit');
	}

	public function testAdminWritesAreLimitedTo120AndFailedAttemptsCount(): void
	{
		$poll = $this->newPoll();
		for ($i = 0; $i < 120; $i++) {
			self::assertSame(403, $this->requestJson('PATCH', '/api/polls/' . $poll['id'], ['closed' => true], self::bearer(Random::token()))->getStatusCode());
		}

		self::assertError(429, 'too_many_requests', $this->requestJson('PATCH', '/api/polls/' . $poll['id'], ['closed' => true], self::bearer($poll['adminToken'])));
		self::assertError(429, 'too_many_requests', $this->request('DELETE', '/api/polls/' . $poll['id'], null, self::bearer($poll['adminToken'])));
	}

	public function testReadingIsNotLimited(): void
	{
		$poll = $this->newPoll();
		for ($i = 0; $i < 20; $i++) {
			$this->createPoll();
		}

		self::assertSame(200, $this->request('GET', '/api/polls/' . $poll['id'])->getStatusCode());
		self::assertSame(200, $this->request('GET', '/api/health')->getStatusCode());
	}

	public function testStoresNoIpAddresses(): void
	{
		foreach (['192.0.2.1', '198.51.100.23', '2001:db8::17'] as $ip) {
			$this->clientIp = $ip;
			$poll = $this->newPoll();
			$this->newResponse($poll['id']);
			$this->request('DELETE', '/api/polls/' . $poll['id'], null, self::bearer($poll['adminToken']));
		}

		foreach (['rate_limits', 'polls', 'responses'] as $table) {
			$statement = $this->pdo->query('SELECT * FROM ' . $table);
			self::assertNotFalse($statement);
			$dump = json_encode($statement->fetchAll(PDO::FETCH_ASSOC), JSON_THROW_ON_ERROR);
			foreach (['192.0.2.1', '198.51.100.23', '2001:db8::17'] as $ip) {
				self::assertStringNotContainsString($ip, $dump, $table);
			}
		}
	}

	private function createPoll(): ResponseInterface
	{
		return $this->requestJson('POST', '/api/polls', ['ciphertext' => Fixtures::ciphertext('P'), 'expiresAt' => $this->clock->now() + 86400]);
	}
}
