<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use TimeLion\Http\ApiError;
use TimeLion\Http\Validate;
use TimeLion\Polls\Limits;

final class ValidateTest extends TestCase
{
	private const string IV = 'AAECAwQFBgcICQoL';
	private const int NOW = 1_800_000_000;

	public function testAcceptsLowercaseHexIds(): void
	{
		self::assertSame('0123456789abcdef0123456789abcdef', Validate::id('0123456789abcdef0123456789abcdef'));
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function malformedIds(): iterable
	{
		yield 'empty' => [''];
		yield 'uppercase' => ['0123456789ABCDEF0123456789ABCDEF'];
		yield 'too short' => [str_repeat('a', 31)];
		yield 'too long' => [str_repeat('a', 33)];
		yield 'not hex' => [str_repeat('z', 32)];
		yield 'trailing newline' => [str_repeat('a', 32) . "\n"];
	}

	#[DataProvider('malformedIds')]
	public function testMalformedIdsAreNotFound(string $id): void
	{
		try {
			Validate::id($id);
			self::fail('Expected ApiError');
		} catch (ApiError $error) {
			self::assertSame(404, $error->status);
			self::assertSame('not_found', $error->errorCode);
		}
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function validCiphertexts(): iterable
	{
		yield 'shortest' => ['v1.' . self::IV . '.' . str_repeat('A', 24)];
		yield 'base64url alphabet' => ['v1.' . 'abcXYZ0189-_ABCD' . '.' . 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'];
		yield 'exactly the size limit' => [self::ciphertextOfSize(100)];
	}

	#[DataProvider('validCiphertexts')]
	public function testAcceptsValidCiphertext(string $value): void
	{
		self::assertSame($value, Validate::ciphertext($value, 100));
	}

	/**
	 * @return iterable<string, array{mixed, string}>
	 */
	public static function invalidCiphertexts(): iterable
	{
		yield 'missing (null)' => [null, 'invalid_ciphertext'];
		yield 'integer' => [42, 'invalid_ciphertext'];
		yield 'boolean' => [true, 'invalid_ciphertext'];
		yield 'array' => [['v1.' . self::IV . '.' . str_repeat('A', 24)], 'invalid_ciphertext'];
		yield 'object' => [['iv' => self::IV], 'invalid_ciphertext'];
		yield 'empty string' => ['', 'invalid_ciphertext'];
		yield 'plaintext' => ['{"title":"Team dinner"}', 'invalid_ciphertext'];
		yield 'other version' => ['v2.' . self::IV . '.' . str_repeat('A', 24), 'invalid_ciphertext'];
		yield 'uppercase version' => ['V1.' . self::IV . '.' . str_repeat('A', 24), 'invalid_ciphertext'];
		yield 'iv too short' => ['v1.' . substr(self::IV, 1) . '.' . str_repeat('A', 24), 'invalid_ciphertext'];
		yield 'iv too long' => ['v1.' . self::IV . 'A.' . str_repeat('A', 24), 'invalid_ciphertext'];
		yield 'ciphertext too short' => ['v1.' . self::IV . '.' . str_repeat('A', 23), 'invalid_ciphertext'];
		yield 'missing ciphertext part' => ['v1.' . self::IV, 'invalid_ciphertext'];
		yield 'extra part' => ['v1.' . self::IV . '.' . str_repeat('A', 24) . '.AAAA', 'invalid_ciphertext'];
		yield 'standard base64' => ['v1.' . self::IV . '.' . str_repeat('A', 22) . '+/', 'invalid_ciphertext'];
		yield 'padding' => ['v1.' . self::IV . '.' . str_repeat('A', 24) . '==', 'invalid_ciphertext'];
		yield 'trailing newline' => ['v1.' . self::IV . '.' . str_repeat('A', 24) . "\n", 'invalid_ciphertext'];
		yield 'leading space' => [' v1.' . self::IV . '.' . str_repeat('A', 24), 'invalid_ciphertext'];
		yield 'null byte' => ['v1.' . self::IV . '.' . str_repeat('A', 24) . "\0", 'invalid_ciphertext'];
		yield 'one byte over the limit' => [self::ciphertextOfSize(101), 'ciphertext_too_large'];
		yield 'far over the limit, even if malformed' => [str_repeat('x', 10_000), 'ciphertext_too_large'];
	}

	#[DataProvider('invalidCiphertexts')]
	public function testRejectsInvalidCiphertext(mixed $value, string $code): void
	{
		self::assertBadRequest($code, static fn(): string => Validate::ciphertext($value, 100));
	}

	public function testCiphertextLimitCountsBytesNotCharacters(): void
	{
		// Multibyte characters can't pass the pattern anyway, but they must be measured in bytes for the size check.
		self::assertBadRequest('ciphertext_too_large', static fn(): string => Validate::ciphertext(str_repeat('ü', 51), 100));
	}

	/**
	 * @return iterable<string, array{int}>
	 */
	public static function validExpiries(): iterable
	{
		yield 'one second from now' => [self::NOW + 1];
		yield 'in a week' => [self::NOW + 7 * 86400];
		yield 'exactly the maximum lifetime' => [self::NOW + Limits::MAX_LIFETIME];
	}

	#[DataProvider('validExpiries')]
	public function testAcceptsValidExpiry(int $value): void
	{
		self::assertSame($value, Validate::expiresAt($value, self::NOW));
	}

	/**
	 * @return iterable<string, array{mixed}>
	 */
	public static function invalidExpiries(): iterable
	{
		yield 'missing (null)' => [null];
		yield 'now' => [self::NOW];
		yield 'in the past' => [self::NOW - 1];
		yield 'zero' => [0];
		yield 'negative' => [-1];
		yield 'one second over the maximum lifetime' => [self::NOW + Limits::MAX_LIFETIME + 1];
		yield 'largest integer' => [PHP_INT_MAX];
		yield 'float' => [(float) (self::NOW + 60)];
		yield 'numeric string' => [(string) (self::NOW + 60)];
		yield 'empty string' => [''];
		yield 'boolean' => [true];
		yield 'array' => [[self::NOW + 60]];
		yield 'milliseconds' => [(self::NOW + 60) * 1000];
	}

	#[DataProvider('invalidExpiries')]
	public function testRejectsInvalidExpiry(mixed $value): void
	{
		self::assertBadRequest('invalid_expiry', static fn(): int => Validate::expiresAt($value, self::NOW));
	}

	public function testAcceptsBooleans(): void
	{
		self::assertTrue(Validate::bool(true, 'closed'));
		self::assertFalse(Validate::bool(false, 'closed'));
	}

	/**
	 * @return iterable<string, array{mixed}>
	 */
	public static function nonBooleans(): iterable
	{
		yield 'missing (null)' => [null];
		yield 'integer one' => [1];
		yield 'integer zero' => [0];
		yield 'string true' => ['true'];
		yield 'empty string' => [''];
		yield 'array' => [[true]];
	}

	#[DataProvider('nonBooleans')]
	public function testRejectsNonBooleans(mixed $value): void
	{
		$error = self::assertBadRequest('invalid_field', static fn(): bool => Validate::bool($value, 'closed'));

		self::assertStringContainsString('"closed"', $error->getMessage());
	}

	private static function ciphertextOfSize(int $bytes): string
	{
		$prefix = 'v1.' . self::IV . '.';

		return $prefix . str_repeat('A', $bytes - strlen($prefix));
	}

	private static function assertBadRequest(string $code, callable $validate): ApiError
	{
		try {
			$validate();
		} catch (ApiError $error) {
			self::assertSame(400, $error->status);
			self::assertSame($code, $error->errorCode);

			return $error;
		}

		self::fail('Expected ApiError ' . $code);
	}
}
