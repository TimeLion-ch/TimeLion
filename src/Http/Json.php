<?php

declare(strict_types=1);

namespace TimeLion\Http;

use JsonException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * JSON request/response helpers shared by all actions.
 */
final class Json
{
	private const int ENCODE_FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
	private const int MAX_DEPTH = 32;

	public static function response(ResponseInterface $response, mixed $data, int $status = 200): ResponseInterface
	{
		$response->getBody()->write(json_encode($data, self::ENCODE_FLAGS));

		return $response
			->withStatus($status)
			->withHeader('Content-Type', 'application/json');
	}

	/**
	 * Decodes a JSON object request body.
	 *
	 * Requiring `Content-Type: application/json` means a browser on another origin cannot send this
	 * request without a CORS preflight, which the API never allows.
	 *
	 * @return array<mixed>
	 *
	 * @throws ApiError
	 */
	public static function decodeBody(ServerRequestInterface $request, int $maxBytes): array
	{
		$contentType = strtolower(trim(explode(';', $request->getHeaderLine('Content-Type'))[0]));
		if ($contentType !== 'application/json') {
			throw ApiError::unsupportedMediaType();
		}

		$body = self::readBody($request, $maxBytes);

		try {
			$data = json_decode($body, true, self::MAX_DEPTH, JSON_THROW_ON_ERROR);
		} catch (JsonException) {
			throw ApiError::badRequest('invalid_json', 'Request body is not valid JSON.');
		}

		if (!is_array($data) || !str_starts_with(ltrim($body), '{')) {
			throw ApiError::badRequest('invalid_json', 'Request body must be a JSON object.');
		}

		return $data;
	}

	/**
	 * Reads at most $maxBytes + 1 bytes, so an oversized body is rejected without being held in memory.
	 *
	 * @throws ApiError 413
	 */
	private static function readBody(ServerRequestInterface $request, int $maxBytes): string
	{
		$contentLength = $request->getHeaderLine('Content-Length');
		if (preg_match('/^\d+$/D', $contentLength) === 1 && (int) $contentLength > $maxBytes) {
			throw ApiError::payloadTooLarge();
		}

		$stream = $request->getBody();
		if ($stream->isSeekable()) {
			$stream->rewind();
		}
		$body = '';
		while (strlen($body) <= $maxBytes && !$stream->eof()) {
			$chunk = $stream->read($maxBytes + 1 - strlen($body));
			if ($chunk === '') {
				break;
			}
			$body .= $chunk;
		}
		if (strlen($body) > $maxBytes) {
			throw ApiError::payloadTooLarge();
		}

		return $body;
	}
}
