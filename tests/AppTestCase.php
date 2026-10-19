<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use DI\Container;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Clock;
use TimeLion\Config;
use TimeLion\Kernel;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\ResponseRepository;

/**
 * Base class for HTTP-level tests: boots the real app against a freshly migrated test database (see TestDatabase)
 * and a FrozenClock.
 */
abstract class AppTestCase extends TestCase
{
	/** @var App<Container> */
	protected App $app;

	protected PDO $pdo;

	protected FrozenClock $clock;

	protected function setUp(): void
	{
		$this->app = Kernel::createApp(self::config());
		$this->pdo = TestDatabase::migrated();
		$this->clock = new FrozenClock();
		$this->app->getContainer()->set(PDO::class, $this->pdo);
		$this->app->getContainer()->set(Clock::class, $this->clock);
	}

	protected function tearDown(): void
	{
		// PHPUnit keeps test case objects until the run ends; don't keep every app and connection alive with them.
		unset($this->app, $this->pdo, $this->clock);
	}

	/**
	 * Creates a poll through the API, open for a week.
	 *
	 * @return array{id: string, adminToken: string}
	 */
	protected function newPoll(): array
	{
		$response = $this->requestJson('POST', '/api/polls', [
			'ciphertext' => Fixtures::ciphertext('P'),
			'expiresAt' => $this->clock->now() + 7 * 86400,
		]);
		self::assertSame(201, $response->getStatusCode());
		$data = self::json($response);
		self::assertIsString($data['id'] ?? null);
		self::assertIsString($data['adminToken'] ?? null);

		return ['id' => $data['id'], 'adminToken' => $data['adminToken']];
	}

	/**
	 * Adds a response through the API.
	 *
	 * @return array{id: string, editToken: string}
	 */
	protected function newResponse(string $pollId, ?string $ciphertext = null): array
	{
		$response = $this->requestJson('POST', '/api/polls/' . $pollId . '/responses', ['ciphertext' => $ciphertext ?? Fixtures::ciphertext('R')]);
		self::assertSame(201, $response->getStatusCode());
		$data = self::json($response);
		self::assertIsString($data['id'] ?? null);
		self::assertIsString($data['editToken'] ?? null);

		return ['id' => $data['id'], 'editToken' => $data['editToken']];
	}

	/**
	 * @return array{Authorization: string}
	 */
	protected static function bearer(string $token): array
	{
		return ['Authorization' => 'Bearer ' . $token];
	}

	protected function polls(): PollRepository
	{
		return new PollRepository($this->pdo);
	}

	protected function responses(): ResponseRepository
	{
		return new ResponseRepository($this->pdo);
	}

	protected static function config(string $env = Config::ENV_PROD): Config
	{
		return TestDatabase::config($env);
	}

	/**
	 * @param array<string, string> $headers
	 */
	protected function request(string $method, string $path, ?string $body = null, array $headers = []): ResponseInterface
	{
		$request = (new ServerRequestFactory())->createServerRequest($method, $path);
		if ($body !== null) {
			$request->getBody()->write($body);
			$request = $request->withHeader('Content-Type', 'application/json');
		}
		foreach ($headers as $name => $value) {
			$request = $request->withHeader($name, $value);
		}

		return $this->app->handle($request);
	}

	/**
	 * @param array<mixed> $data
	 * @param array<string, string> $headers
	 */
	protected function requestJson(string $method, string $path, array $data, array $headers = []): ResponseInterface
	{
		return $this->request($method, $path, json_encode($data, JSON_THROW_ON_ERROR), $headers);
	}

	/**
	 * @return array<mixed>
	 */
	protected static function json(ResponseInterface $response): array
	{
		self::assertSame('application/json', $response->getHeaderLine('Content-Type'));
		$data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
		self::assertIsArray($data);

		return $data;
	}

	protected static function errorCode(ResponseInterface $response): mixed
	{
		$error = self::json($response)['error'] ?? null;

		return is_array($error) ? ($error['code'] ?? null) : null;
	}

	/**
	 * Asserts an error response and returns its message.
	 */
	protected static function assertError(int $status, string $code, ResponseInterface $response): string
	{
		self::assertSame($status, $response->getStatusCode(), (string) $response->getBody());
		$error = self::json($response)['error'] ?? null;
		self::assertIsArray($error);
		self::assertSame($code, $error['code'] ?? null);
		self::assertIsString($error['message'] ?? null);

		return $error['message'];
	}
}
