<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Http\ApiError;
use TimeLion\Http\BearerToken;

final class BearerTokenTest extends TestCase
{
	private const string TOKEN = '78Fy1spBVJ1gUmMwbMZ8BTXz_N-rycKaoJ6QrIscv8Q';

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function validHeaders(): iterable
	{
		yield 'canonical' => ['Bearer ' . self::TOKEN];
		yield 'lowercase scheme' => ['bearer ' . self::TOKEN];
		yield 'several spaces' => ['Bearer   ' . self::TOKEN];
		yield 'surrounding whitespace' => [' Bearer ' . self::TOKEN . ' '];
	}

	#[DataProvider('validHeaders')]
	public function testAcceptsWellFormedTokens(string $header): void
	{
		self::assertSame(self::TOKEN, BearerToken::fromRequest(self::request($header)));
	}

	/**
	 * @return iterable<string, array{string|null}>
	 */
	public static function invalidHeaders(): iterable
	{
		yield 'missing' => [null];
		yield 'empty' => [''];
		yield 'scheme only' => ['Bearer'];
		yield 'basic auth' => ['Basic ' . base64_encode('user:password')];
		yield 'no space' => ['Bearer' . self::TOKEN];
		yield 'too short' => ['Bearer ' . substr(self::TOKEN, 1)];
		yield 'too long' => ['Bearer ' . self::TOKEN . 'A'];
		yield 'padding' => ['Bearer ' . substr(self::TOKEN, 1) . '='];
		yield 'standard base64' => ['Bearer ' . strtr(self::TOKEN, '-_', '+/')];
		yield 'trailing data' => ['Bearer ' . self::TOKEN . ' extra'];
		yield 'two tokens' => ['Bearer ' . self::TOKEN . ', Bearer ' . self::TOKEN];
	}

	#[DataProvider('invalidHeaders')]
	public function testRejectsMissingOrMalformedTokensWith401(?string $header): void
	{
		try {
			BearerToken::fromRequest(self::request($header));
			self::fail('Expected ApiError');
		} catch (ApiError $error) {
			self::assertSame(401, $error->status);
			self::assertSame('unauthorized', $error->errorCode);
		}
	}

	private static function request(?string $authorization): ServerRequestInterface
	{
		$request = (new ServerRequestFactory())->createServerRequest('POST', '/api/x');

		return $authorization === null ? $request : $request->withHeader('Authorization', $authorization);
	}
}
