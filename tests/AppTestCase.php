<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use DI\Container;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Config;
use TimeLion\Kernel;

/**
 * Base class for HTTP-level tests: boots the real app against an in-memory SQLite database.
 */
abstract class AppTestCase extends TestCase
{
	/** @var App<Container> */
	protected App $app;

	protected function setUp(): void
	{
		$this->app = Kernel::createApp(self::config());
	}

	protected static function config(string $env = Config::ENV_PROD): Config
	{
		return new Config($env, 'sqlite::memory:', null, null, str_repeat('s', Config::MIN_SECRET_LENGTH));
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
