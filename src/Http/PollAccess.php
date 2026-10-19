<?php

declare(strict_types=1);

namespace TimeLion\Http;

use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Polls\Poll;
use TimeLion\Repository\PollRepository;
use TimeLion\Security\TokenHash;

/**
 * Looks up the poll a request addresses and checks its capability token, always in the same order:
 * token format (401), poll ID and existence (404), token match (403). The ID check comes before any database access.
 */
final readonly class PollAccess
{
	public function __construct(
		private PollRepository $polls,
	) {}

	/**
	 * @param int $now Unix seconds
	 *
	 * @throws ApiError 404 if the ID is malformed or the poll is unknown or expired
	 */
	public function poll(string $id, int $now): Poll
	{
		return $this->polls->findActive(Validate::id($id), $now) ?? throw ApiError::notFound();
	}

	/**
	 * @param int $now Unix seconds
	 *
	 * @throws ApiError 401, 404 or 403
	 */
	public function pollForAdmin(ServerRequestInterface $request, string $id, int $now): Poll
	{
		$token = BearerToken::fromRequest($request);
		$poll = $this->poll($id, $now);
		if (!TokenHash::matches($token, $poll->adminTokenHash)) {
			throw ApiError::forbidden();
		}

		return $poll;
	}
}
