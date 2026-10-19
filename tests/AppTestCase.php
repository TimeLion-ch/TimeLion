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
	 * @return array<mixed>
	 */
	protected static function json(ResponseInterface $response): array
	{
		self::assertSame('application/json', $response->getHeaderLine('Content-Type'));
		$data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
		self::assertIsArray($data);

		return $data;
	}
}
