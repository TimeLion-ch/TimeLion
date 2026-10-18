<?php

declare(strict_types=1);

namespace TimeLion\Tests\Security;

use PHPUnit\Framework\TestCase;
use TimeLion\Security\TokenHash;

final class TokenHashTest extends TestCase
{
	public function testHashIsLowercaseSha256Hex(): void
	{
		self::assertSame('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', TokenHash::hash('abc'));
	}

	public function testMatchesOnlyTheHashedToken(): void
	{
		$hash = TokenHash::hash('78Fy1spBVJ1gUmMwbMZ8BTXz_N-rycKaoJ6QrIscv8Q');

		self::assertTrue(TokenHash::matches('78Fy1spBVJ1gUmMwbMZ8BTXz_N-rycKaoJ6QrIscv8Q', $hash));
		self::assertFalse(TokenHash::matches('qF6gHKgVCt6phJkY7FpOjImUkMqH4_BOQwLSDiY2JJY', $hash));
		self::assertFalse(TokenHash::matches('', $hash));
	}
}
