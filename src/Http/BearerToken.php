<?php

declare(strict_types=1);

namespace TimeLion\Http;

use Psr\Http\Message\ServerRequestInterface;

/**
 * Reads the capability token from `Authorization: Bearer <token>`.
 */
final class BearerToken
{
	/** 32 random bytes, base64url-encoded without padding. */
	private const string PATTERN = '/^Bearer +([A-Za-z0-9_-]{43})$/Di';

	/**
	 * @throws ApiError 401 if the header is missing or does not carry a well-formed token
	 */
	public static function fromRequest(ServerRequestInterface $request): string
	{
		if (preg_match(self::PATTERN, trim($request->getHeaderLine('Authorization')), $matches) !== 1) {
			throw ApiError::unauthorized();
		}

		return $matches[1];
	}
}
