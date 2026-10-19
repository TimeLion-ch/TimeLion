<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\Json;
use TimeLion\Http\Validate;
use TimeLion\Polls\Limits;
use TimeLion\Polls\Poll;
use TimeLion\Repository\PollRepository;
use TimeLion\Security\Random;
use TimeLion\Security\RateLimit;
use TimeLion\Security\RateLimiter;
use TimeLion\Security\TokenHash;

/**
 * POST /api/polls – stores a new encrypted poll. The server picks the ID and the admin token and keeps only the
 * token's hash, so the response is the only time the token exists on the server.
 */
final readonly class CreatePollAction
{
	public function __construct(
		private RateLimiter $rateLimiter,
		private PollRepository $polls,
		private Clock $clock,
	) {}

	public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
	{
		$this->rateLimiter->hit(RateLimit::CreatePoll, $request);
		$body = Json::decodeBody($request, Limits::MAX_BODY_BYTES);
		$now = $this->clock->now();
		$ciphertext = Validate::ciphertext($body['ciphertext'] ?? null, Limits::MAX_POLL_CIPHERTEXT_BYTES);
		$expiresAt = Validate::expiresAt($body['expiresAt'] ?? null, $now);

		$adminToken = Random::token();
		$poll = new Poll(
			id: Random::id(),
			adminTokenHash: TokenHash::hash($adminToken),
			ciphertext: $ciphertext,
			createdAt: $now,
			updatedAt: $now,
			expiresAt: $expiresAt,
			closedAt: null,
		);
		$this->polls->insert($poll);

		return Json::response($response, [
			'id' => $poll->id,
			'adminToken' => $adminToken,
			'createdAt' => $poll->createdAt,
			'expiresAt' => $poll->expiresAt,
		], 201);
	}
}
