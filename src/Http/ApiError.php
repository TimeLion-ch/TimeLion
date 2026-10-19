<?php

declare(strict_types=1);

namespace TimeLion\Http;

use RuntimeException;
use Throwable;

/**
 * An error that is shown to API clients as `{"error": {"code": ..., "message": ...}}`.
 *
 * `errorCode` is a stable snake_case identifier the frontend can switch on; `message` is English
 * developer-facing text and must never contain user data.
 */
final class ApiError extends RuntimeException
{
	/**
	 * @param array<string, string> $headers extra response headers, e.g. Retry-After
	 */
	public function __construct(
		public readonly int $status,
		public readonly string $errorCode,
		string $message,
		?Throwable $previous = null,
		public readonly array $headers = [],
	) {
		parent::__construct($message, 0, $previous);
	}

	public static function badRequest(string $errorCode, string $message): self
	{
		return new self(400, $errorCode, $message);
	}

	public static function unauthorized(string $message = 'Missing or malformed access token.'): self
	{
		return new self(401, 'unauthorized', $message);
	}

	public static function forbidden(string $message = 'The access token is not valid for this resource.'): self
	{
		return new self(403, 'forbidden', $message);
	}

	public static function notFound(string $message = 'Not found.'): self
	{
		return new self(404, 'not_found', $message);
	}

	public static function conflict(string $errorCode, string $message): self
	{
		return new self(409, $errorCode, $message);
	}

	public static function payloadTooLarge(string $message = 'Request body is too large.'): self
	{
		return new self(413, 'payload_too_large', $message);
	}

	public static function unsupportedMediaType(string $message = 'Request body must be application/json.'): self
	{
		return new self(415, 'unsupported_media_type', $message);
	}

	/**
	 * @param int $retryAfter seconds until the client may try again
	 */
	public static function tooManyRequests(int $retryAfter): self
	{
		return new self(429, 'too_many_requests', 'Too many requests. Try again later.', null, ['Retry-After' => (string) $retryAfter]);
	}
}
