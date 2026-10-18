<?php

declare(strict_types=1);

namespace TimeLion\Security;

/**
 * Tokens are never stored, only their SHA-256 hash, and they are compared in constant time.
 */
final class TokenHash
{
	/**
	 * @return string 64 lowercase hex characters
	 */
	public static function hash(string $token): string
	{
		return hash('sha256', $token);
	}

	public static function matches(string $token, string $hash): bool
	{
		return hash_equals($hash, self::hash($token));
	}
}
