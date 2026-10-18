<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Http\ApiError;
use TimeLion\Http\Json;

final class JsonTest extends TestCase
{
	public function testDecodesJsonObject(): void
	{
		self::assertSame(['a' => 1, 'b' => ['c' => true]], Json::decodeBody(self::request('{"a":1,"b":{"c":true}}'), 1024));
	}

	public function testAcceptsCharsetParameter(): void
	{
		self::assertSame([], Json::decodeBody(self::request('{}', 'application/json; charset=utf-8'), 1024));
	}

	/**
	 * @return iterable<string, array{string, string, int, string}>
	 */
	public static function invalidBodies(): iterable
	{
		yield 'wrong content type' => ['{}', 'text/plain', 415, 'unsupported_media_type'];
		yield 'too large' => ['{"a":"' . str_repeat('x', 100) . '"}', 'application/json', 413, 'payload_too_large'];
		yield 'malformed' => ['{"a":', 'application/json', 400, 'invalid_json'];
		yield 'array instead of object' => ['[1,2]', 'application/json', 400, 'invalid_json'];
		yield 'empty array' => ['[]', 'application/json', 400, 'invalid_json'];
		yield 'scalar' => ['"text"', 'application/json', 400, 'invalid_json'];
	}

	#[DataProvider('invalidBodies')]
	public function testRejectsInvalidBodies(string $body, string $contentType, int $status, string $code): void
	{
		try {
			Json::decodeBody(self::request($body, $contentType), 64);
			self::fail('Expected ApiError');
		} catch (ApiError $error) {
			self::assertSame($status, $error->status);
			self::assertSame($code, $error->errorCode);
		}
	}

	private static function request(string $body, string $contentType = 'application/json'): ServerRequestInterface
	{
		$request = (new ServerRequestFactory())->createServerRequest('POST', '/api/x')->withHeader('Content-Type', $contentType);
		$request->getBody()->write($body);

		return $request;
	}
}
