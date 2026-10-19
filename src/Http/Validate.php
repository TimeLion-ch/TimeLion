<?php

declare(strict_types=1);

namespace TimeLion\Http;

use TimeLion\Polls\Limits;

/**
 * Validates decoded request fields. Each method returns the typed value or throws ApiError 400.
 *
 * Error messages name the field, never its value.
 */
final class Validate
{
	/**
	 * The envelope `v1.{iv}.{ciphertext‖tag}` in base64url: 16 characters are the 12-byte IV, and 24 characters are
	 * 18 bytes, the 16-byte tag plus the 2 bytes of the shortest JSON plaintext (`{}`). `D`: `$` must not match before
	 * a trailing newline.
	 */
	public const string CIPHERTEXT_PATTERN = '/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,}$/D';

	/**
	 * @throws ApiError invalid_ciphertext or ciphertext_too_large
	 */
	public static function ciphertext(mixed $value, int $maxBytes): string
	{
		if (!is_string($value)) {
			throw ApiError::badRequest('invalid_ciphertext', 'Field "ciphertext" must be a string.');
		}
		// Checked before the pattern, so the size limit is reported as such.
		if (strlen($value) > $maxBytes) {
			throw ApiError::badRequest('ciphertext_too_large', sprintf('Field "ciphertext" must be at most %d bytes.', $maxBytes));
		}
		if (preg_match(self::CIPHERTEXT_PATTERN, $value) !== 1) {
			throw ApiError::badRequest('invalid_ciphertext', 'Field "ciphertext" is not a v1 ciphertext envelope.');
		}

		return $value;
	}

	/**
	 * @param int $now Unix seconds
	 *
	 * @return int Unix seconds, later than $now and at most Limits::MAX_LIFETIME after it
	 *
	 * @throws ApiError invalid_expiry
	 */
	public static function expiresAt(mixed $value, int $now): int
	{
		if (!is_int($value)) {
			throw ApiError::badRequest('invalid_expiry', 'Field "expiresAt" must be an integer (Unix seconds).');
		}
		if ($value <= $now || $value > $now + Limits::MAX_LIFETIME) {
			throw ApiError::badRequest(
				'invalid_expiry',
				sprintf('Field "expiresAt" must be in the future and at most %d days from now.', intdiv(Limits::MAX_LIFETIME, 86400)),
			);
		}

		return $value;
	}

	/**
	 * @throws ApiError invalid_field
	 */
	public static function bool(mixed $value, string $field): bool
	{
		if (!is_bool($value)) {
			throw ApiError::badRequest('invalid_field', sprintf('Field "%s" must be a boolean.', $field));
		}

		return $value;
	}
}
