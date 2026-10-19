<?php

declare(strict_types=1);

namespace TimeLion\Security;

use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Config;
use TimeLion\Http\ApiError;
use TimeLion\Http\ClientIp;
use TimeLion\Repository\RateLimitRepository;

/**
 * Fixed-window rate limits per action and client IP, without storing the IP (CLAUDE.md, rule 5).
 *
 * bucket   = HMAC-SHA256(dailyKey, action + "|" + clientIp)
 * dailyKey = HMAC-SHA256(config secret, "rate-limit|" + UTC date)
 *
 * The key changes every UTC day, so a bucket can't be linked to the same IP on another day, and without the secret
 * a bucket can't be tested against guessed IPs. Windows start at full UTC hours, so the key never changes mid-window.
 */
final readonly class RateLimiter
{
	public function __construct(
		private RateLimitRepository $repository,
		private Clock $clock,
		private Config $config,
	) {}

	/**
	 * Counts the request against the limit.
	 *
	 * @throws ApiError 429 too_many_requests, with Retry-After, once the window's limit is used up
	 */
	public function hit(RateLimit $limit, ServerRequestInterface $request): void
	{
		$now = $this->clock->now();
		$windowStart = self::windowStart($now);
		$bucket = $this->bucket($limit, ClientIp::fromRequest($request, $this->config->trustedProxyHeader), $now);

		if ($this->repository->hit($bucket, $windowStart) > $limit->perWindow()) {
			throw ApiError::tooManyRequests($windowStart + RateLimit::WINDOW - $now);
		}
	}

	/**
	 * @return string 64 lowercase hex characters
	 */
	public function bucket(RateLimit $limit, string $clientIp, int $now): string
	{
		$dailyKey = hash_hmac('sha256', 'rate-limit|' . gmdate('Y-m-d', $now), $this->config->secret, true);

		return hash_hmac('sha256', $limit->value . '|' . $clientIp, $dailyKey);
	}

	public static function windowStart(int $now): int
	{
		return $now - $now % RateLimit::WINDOW;
	}
}
