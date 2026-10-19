<?php

declare(strict_types=1);

namespace TimeLion\Tests\Security;

use PHPUnit\Framework\TestCase;
use TimeLion\Security\Random;

final class RandomTest extends TestCase
{
	public function testIdIs32LowercaseHexCharacters(): void
	{
		for ($i = 0; $i < 100; $i++) {
			self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/D', Random::id());
		}
	}

	public function testTokenIs43Base64urlCharacters(): void
	{
		// 100 tokens make it very likely that '-' and '_' occur, which standard base64 would encode as '+' and '/'.
		for ($i = 0; $i < 100; $i++) {
			self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', Random::token());
		}
	}

	public function testTokenDecodesToThirtyTwoBytes(): void
	{
		$bytes = base64_decode(strtr(Random::token(), '-_', '+/'), true);

		self::assertIsString($bytes);
		self::assertSame(32, strlen($bytes));
	}

	public function testValuesDoNotRepeat(): void
	{
		$ids = array_map(static fn(): string => Random::id(), range(1, 1000));
		$tokens = array_map(static fn(): string => Random::token(), range(1, 1000));

		self::assertCount(1000, array_unique($ids));
		self::assertCount(1000, array_unique($tokens));
	}
}
