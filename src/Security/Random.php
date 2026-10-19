<?php

declare(strict_types=1);

namespace TimeLion\Security;

/**
 * Server-generated identifiers and capability tokens (decision D4), from random_bytes() only.
 */
final class Random
{
	/**
	 * @return string 16 random bytes as 32 lowercase hex characters: lowercase because MySQL collations ignore case
	 */
	public static function id(): string
	{
		return bin2hex(random_bytes(16));
	}

	/**
	 * @return string 32 random bytes as 43 base64url characters, without padding
	 */
	public static function token(): string
	{
		return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
	}
}
