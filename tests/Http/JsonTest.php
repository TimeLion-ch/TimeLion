<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;
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

	public function testAcceptsBodyOfExactlyTheLimit(): void
	{
		$body = '{"a":"' . str_repeat('x', 56) . '"}';
		self::assertSame(64, strlen($body));

		self::assertSame(['a' => str_repeat('x', 56)], Json::decodeBody(self::request($body), 64));
	}

	public function testRejectsDeclaredContentLengthOverTheLimitWithoutReading(): void
	{
		$stream = (new StreamFactory())->createStream('{}');
		$request = self::request('{}')->withBody($stream)->withHeader('Content-Length', '65');

		self::assertPayloadTooLarge($request, 64);
		self::assertSame(0, $stream->tell(), 'the body was not read');
	}

	public function testHugeContentLengthIsRejected(): void
	{
		self::assertPayloadTooLarge(self::request('{}')->withHeader('Content-Length', '99999999999999999999999'), 64);
	}

	public function testReadsNoMoreThanOneByteOverTheLimit(): void
	{
		// No Content-Length, as with chunked transfer encoding.
		$stream = (new StreamFactory())->createStream('{"a":"' . str_repeat('x', 1_000_000) . '"}');
		$request = (new ServerRequestFactory())->createServerRequest('POST', '/api/x')->withHeader('Content-Type', 'application/json')->withBody($stream);

		self::assertPayloadTooLarge($request, 64);
		self::assertSame(65, $stream->tell());
	}

	public function testReadsTheBodyFromTheStart(): void
	{
		// request() writes the body, which leaves the stream at its end.
		$request = self::request('{"a":1}');
		self::assertTrue($request->getBody()->eof() || $request->getBody()->tell() > 0);

		self::assertSame(['a' => 1], Json::decodeBody($request, 64));
	}

	private static function assertPayloadTooLarge(ServerRequestInterface $request, int $maxBytes): void
	{
		try {
			Json::decodeBody($request, $maxBytes);
			self::fail('Expected ApiError');
		} catch (ApiError $error) {
			self::assertSame(413, $error->status);
			self::assertSame('payload_too_large', $error->errorCode);
		}
	}

	private static function request(string $body, string $contentType = 'application/json'): ServerRequestInterface
	{
		$request = (new ServerRequestFactory())->createServerRequest('POST', '/api/x')->withHeader('Content-Type', $contentType);
		$request->getBody()->write($body);

		return $request;
	}
}
