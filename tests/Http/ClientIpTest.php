<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Http\ClientIp;

final class ClientIpTest extends TestCase
{
	public function testUsesRemoteAddress(): void
	{
		self::assertSame('192.0.2.1', ClientIp::fromRequest(self::request('192.0.2.1'), null));
		self::assertSame('2001:db8::1', ClientIp::fromRequest(self::request('2001:db8::1'), null));
	}

	public function testIsEmptyWithoutRemoteAddress(): void
	{
		self::assertSame('', ClientIp::fromRequest(self::request(null), null));
	}

	public function testIgnoresProxyHeadersUnlessConfigured(): void
	{
		$request = self::request('192.0.2.1', ['X-Forwarded-For' => '198.51.100.7']);

		self::assertSame('192.0.2.1', ClientIp::fromRequest($request, null));
	}

	/**
	 * @return iterable<string, array{string, string}>
	 */
	public static function trustedHeaderValues(): iterable
	{
		yield 'single address' => ['198.51.100.7', '198.51.100.7'];
		yield 'list: the entry the proxy added' => ['203.0.113.9, 198.51.100.7', '198.51.100.7'];
		yield 'spaces around entries' => [' 203.0.113.9 ,  198.51.100.7 ', '198.51.100.7'];
		yield 'IPv6' => ['2001:db8::7', '2001:db8::7'];
	}

	#[DataProvider('trustedHeaderValues')]
	public function testUsesTheLastEntryOfTheTrustedHeader(string $header, string $expected): void
	{
		$request = self::request('10.0.0.1', ['X-Forwarded-For' => $header]);

		self::assertSame($expected, ClientIp::fromRequest($request, 'X-Forwarded-For'));
	}

	/**
	 * @return iterable<string, array{array<string, string>}>
	 */
	public static function unusableHeaders(): iterable
	{
		yield 'missing' => [[]];
		yield 'empty' => [['X-Forwarded-For' => '']];
		yield 'not an address' => [['X-Forwarded-For' => 'unknown']];
		yield 'last entry not an address' => [['X-Forwarded-For' => '198.51.100.7, evil']];
		yield 'with port' => [['X-Forwarded-For' => '198.51.100.7:1234']];
	}

	/**
	 * @param array<string, string> $headers
	 */
	#[DataProvider('unusableHeaders')]
	public function testFallsBackToRemoteAddress(array $headers): void
	{
		self::assertSame('10.0.0.1', ClientIp::fromRequest(self::request('10.0.0.1', $headers), 'X-Forwarded-For'));
	}

	/**
	 * @param array<string, string> $headers
	 */
	private static function request(?string $remoteAddress, array $headers = []): ServerRequestInterface
	{
		$request = (new ServerRequestFactory())->createServerRequest('POST', '/api/polls', $remoteAddress === null ? [] : ['REMOTE_ADDR' => $remoteAddress]);
		foreach ($headers as $name => $value) {
			$request = $request->withHeader($name, $value);
		}

		return $request;
	}
}
