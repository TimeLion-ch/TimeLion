<?php

declare(strict_types=1);

namespace TimeLion\Http;

use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Polls\Poll;
use TimeLion\Polls\PollResponse;
use TimeLion\Repository\PollRepository;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Security\TokenHash;

/**
 * Looks up the poll or response a request addresses and checks its capability token, always in the same order:
 * token format (401), IDs and existence (404), token match (403). The ID checks come before any database access.
 */
final readonly class PollAccess
{
	public function __construct(
		private PollRepository $polls,
		private ResponseRepository $responses,
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

	/**
	 * For changing a response: only its own edit token is accepted.
	 *
	 * @param int $now Unix seconds
	 *
	 * @return array{Poll, PollResponse}
	 *
	 * @throws ApiError 401, 404 or 403
	 */
	public function responseForEditor(ServerRequestInterface $request, string $pollId, string $responseId, int $now): array
	{
		$token = BearerToken::fromRequest($request);
		[$poll, $response] = $this->response($pollId, $responseId, $now);
		if (!TokenHash::matches($token, $response->editTokenHash)) {
			throw ApiError::forbidden();
		}

		return [$poll, $response];
	}

	/**
	 * For deleting a response: its own edit token or the poll's admin token.
	 *
	 * @param int $now Unix seconds
	 *
	 * @return array{Poll, PollResponse}
	 *
	 * @throws ApiError 401, 404 or 403
	 */
	public function responseForEditorOrAdmin(ServerRequestInterface $request, string $pollId, string $responseId, int $now): array
	{
		$token = BearerToken::fromRequest($request);
		[$poll, $response] = $this->response($pollId, $responseId, $now);
		$isEditor = TokenHash::matches($token, $response->editTokenHash);
		$isAdmin = TokenHash::matches($token, $poll->adminTokenHash);
		if (!$isEditor && !$isAdmin) {
			throw ApiError::forbidden();
		}

		return [$poll, $response];
	}

	/**
	 * @return array{Poll, PollResponse}
	 *
	 * @throws ApiError 404 if an ID is malformed, the poll is unknown or expired, or the response is not the poll's
	 */
	private function response(string $pollId, string $responseId, int $now): array
	{
		$responseId = Validate::id($responseId);
		$poll = $this->poll($pollId, $now);
		$response = $this->responses->find($poll->id, $responseId) ?? throw ApiError::notFound();

		return [$poll, $response];
	}
}
