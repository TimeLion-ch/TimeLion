<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\ApiError;
use TimeLion\Http\Json;
use TimeLion\Http\PollAccess;
use TimeLion\Http\Validate;
use TimeLion\Polls\Limits;
use TimeLion\Polls\Poll;
use TimeLion\Repository\PollRepository;
use TimeLion\Security\RateLimit;
use TimeLion\Security\RateLimiter;

/**
 * PATCH /api/polls/{id} – the admin replaces the ciphertext, moves the expiry, or closes or reopens the poll.
 * All given fields are validated before anything is written.
 */
final readonly class UpdatePollAction
{
	private const array FIELDS = ['ciphertext', 'expiresAt', 'closed'];

	public function __construct(
		private RateLimiter $rateLimiter,
		private PollAccess $access,
		private PollRepository $polls,
		private Clock $clock,
	) {}

	/**
	 * @param array<string, string> $args
	 */
	public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
	{
		$this->rateLimiter->hit(RateLimit::AdminWrite, $request);
		$now = $this->clock->now();
		$poll = $this->access->pollForAdmin($request, $args['id'] ?? '', $now);

		$body = Json::decodeBody($request, Limits::MAX_BODY_BYTES);
		if (array_intersect(self::FIELDS, array_keys($body)) === []) {
			throw ApiError::badRequest('empty_patch', 'The body must contain at least one of "ciphertext", "expiresAt" and "closed".');
		}

		$ciphertext = array_key_exists('ciphertext', $body)
			? Validate::ciphertext($body['ciphertext'], Limits::MAX_POLL_CIPHERTEXT_BYTES)
			: $poll->ciphertext;
		$expiresAt = array_key_exists('expiresAt', $body) ? Validate::expiresAt($body['expiresAt'], $now) : $poll->expiresAt;
		$closedAt = $poll->closedAt;
		if (array_key_exists('closed', $body)) {
			// Closing a closed poll keeps the time it was first closed.
			$closedAt = Validate::bool($body['closed'], 'closed') ? ($poll->closedAt ?? $now) : null;
		}

		$updated = new Poll($poll->id, $poll->adminTokenHash, $ciphertext, $poll->createdAt, $now, $expiresAt, $closedAt);
		$this->polls->update($updated);

		return Json::response($response, [
			'id' => $updated->id,
			'updatedAt' => $updated->updatedAt,
			'expiresAt' => $updated->expiresAt,
			'closedAt' => $updated->closedAt,
		]);
	}
}
