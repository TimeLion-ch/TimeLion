<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use Psr\Http\Message\ResponseInterface;
use RuntimeException;
use TimeLion\Polls\Limits;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

/**
 * ApiHeadersMiddleware is the outermost middleware, so every kind of API response carries its headers: successes,
 * client errors and server errors. On Apache, public/.htaccess adds the page headers on top.
 */
final class SecurityHeadersTest extends AppTestCase
{
	public function testEveryKindOfResponseCarriesTheHeaders(): void
	{
		$created = $this->requestJson('POST', '/api/polls', [
			'ciphertext' => Fixtures::ciphertext(),
			'expiresAt' => $this->clock->now() + 86400,
		]);
		$poll = self::json($created);
		self::assertIsString($poll['id'] ?? null);
		self::assertIsString($poll['adminToken'] ?? null);
		$path = '/api/polls/' . $poll['id'];

		$responses = [
			'201 created' => $created,
			'200 read' => $this->request('GET', $path),
			'400 invalid JSON' => $this->request('POST', '/api/polls', '{'),
			'401 no token' => $this->request('DELETE', $path),
			'403 wrong token' => $this->request('DELETE', $path, null, self::bearer(str_repeat('A', 43))),
			'404 unknown route' => $this->request('GET', '/api/nothing-here'),
			'405 wrong method' => $this->request('PUT', '/api/health'),
			'413 body too large' => $this->request('POST', '/api/polls', str_repeat(' ', Limits::MAX_BODY_BYTES + 1)),
			'415 not JSON' => $this->request('POST', '/api/polls', '{}', ['Content-Type' => 'text/plain']),
			'204 deleted' => $this->request('DELETE', $path, null, self::bearer($poll['adminToken'])),
		];

		foreach ($responses as $name => $response) {
			self::assertSame((int) substr($name, 0, 3), $response->getStatusCode(), $name);
			self::assertSecurityHeaders($response, $name);
		}
	}

	public function testServerErrorsCarryTheHeaders(): void
	{
		$this->expectErrorLog();
		$this->app->get('/test/crash', function (): never {
			throw new RuntimeException('boom');
		});

		$response = $this->request('GET', '/api/test/crash');

		self::assertSame(500, $response->getStatusCode());
		self::assertSecurityHeaders($response, '500 server error');
	}

	private static function assertSecurityHeaders(ResponseInterface $response, string $name): void
	{
		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'), $name);
		self::assertSame("default-src 'none'; frame-ancestors 'none'", $response->getHeaderLine('Content-Security-Policy'), $name);
		self::assertSame('no-referrer', $response->getHeaderLine('Referrer-Policy'), $name);
		self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'), $name);
		self::assertSame('noindex', $response->getHeaderLine('X-Robots-Tag'), $name);
	}
}
