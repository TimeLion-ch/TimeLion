<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use RuntimeException;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Throwable;
use TimeLion\Config;
use TimeLion\Http\ApiError;
use TimeLion\Http\ErrorHandler;
use TimeLion\Kernel;
use TimeLion\Tests\AppTestCase;

final class ErrorHandlingTest extends AppTestCase
{
	/** @var list<string> */
	private array $logged = [];

	public function testUnknownRouteIsJson404(): void
	{
		$response = $this->request('GET', '/api/does-not-exist');

		self::assertSame(404, $response->getStatusCode());
		self::assertSame(['error' => ['code' => 'not_found', 'message' => 'Not found.']], self::json($response));
		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'), 'error responses keep the API headers');
	}

	public function testWrongMethodIs405WithAllowHeader(): void
	{
		$response = $this->request('DELETE', '/api/health');

		self::assertSame(405, $response->getStatusCode());
		self::assertSame('method_not_allowed', self::errorCode($response));
		self::assertSame('GET', $response->getHeaderLine('Allow'));
	}

	public function testApiErrorKeepsStatusAndCode(): void
	{
		$this->app->get('/test/conflict', function (): never {
			throw ApiError::conflict('poll_closed', 'This poll is closed.');
		});

		$response = $this->request('GET', '/api/test/conflict');

		self::assertSame(409, $response->getStatusCode());
		self::assertSame(['error' => ['code' => 'poll_closed', 'message' => 'This poll is closed.']], self::json($response));
	}

	public function testUnexpectedExceptionHidesDetailsInProduction(): void
	{
		$this->expectErrorLog();
		$this->app->get('/test/crash', function (): never {
			throw new RuntimeException('secret internals');
		});

		$response = $this->request('GET', '/api/test/crash');

		self::assertSame(500, $response->getStatusCode());
		self::assertSame(['error' => ['code' => 'internal_error', 'message' => 'Internal server error.']], self::json($response));
	}

	public function testUnexpectedExceptionShowsDetailsInDevelopment(): void
	{
		$this->expectErrorLog();
		$this->app = Kernel::createApp(self::config(Config::ENV_DEV));
		$this->app->get('/test/crash', function (): never {
			throw new RuntimeException('visible internals');
		});

		$body = (string) $this->request('GET', '/api/test/crash')->getBody();

		self::assertStringContainsString('visible internals', $body);
	}

	public function testClientErrorsAreNotLogged(): void
	{
		$this->invokeHandler(ApiError::notFound());

		self::assertSame([], $this->logged);
	}

	public function testServerErrorsAreLogged(): void
	{
		$this->invokeHandler(new RuntimeException('boom'));

		self::assertCount(1, $this->logged);
		self::assertStringContainsString('RuntimeException: boom', $this->logged[0] ?? '');
	}

	public function testLoggedTraceOmitsCallArguments(): void
	{
		$secret = 'token-that-must-not-be-logged';
		$this->invokeHandler((static fn(string $token): RuntimeException => new RuntimeException('boom'))($secret));

		self::assertStringContainsString('#0 ', $this->logged[0] ?? '');
		self::assertStringNotContainsString($secret, $this->logged[0] ?? '');
	}

	private function invokeHandler(Throwable $exception): void
	{
		$handler = new ErrorHandler(new ResponseFactory(), function (string $message): void {
			$this->logged[] = $message;
		});
		$handler((new ServerRequestFactory())->createServerRequest('GET', '/api/x'), $exception, false, true, true);
	}

	private static function errorCode(\Psr\Http\Message\ResponseInterface $response): mixed
	{
		$error = self::json($response)['error'] ?? null;

		return is_array($error) ? ($error['code'] ?? null) : null;
	}
}
