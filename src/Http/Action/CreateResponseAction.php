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
use TimeLion\Polls\PollResponse;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Security\Random;
use TimeLion\Security\TokenHash;

/**
 * POST /api/polls/{id}/responses – anyone with the link adds an encrypted response. The server picks the ID and the
 * edit token and keeps only the token's hash.
 */
final readonly class CreateResponseAction
{
	public function __construct(
		private PollAccess $access,
		private ResponseRepository $responses,
		private Clock $clock,
	) {}

	/**
	 * @param array<string, string> $args
	 */
	public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
	{
		$now = $this->clock->now();
		$poll = $this->access->poll($args['id'] ?? '', $now);
		$body = Json::decodeBody($request, Limits::MAX_BODY_BYTES);
		$ciphertext = Validate::ciphertext($body['ciphertext'] ?? null, Limits::MAX_RESPONSE_CIPHERTEXT_BYTES);

		if ($poll->closedAt !== null) {
			throw ApiError::conflict('poll_closed', 'This poll is closed.');
		}
		// Counting and inserting are not atomic, so concurrent requests can pass the limit by a few. The limit bounds
		// storage per poll; the rate limit bounds how fast anyone can get near it.
		if ($this->responses->countForPoll($poll->id) >= Limits::MAX_RESPONSES_PER_POLL) {
			throw ApiError::conflict('too_many_responses', sprintf('A poll can have at most %d responses.', Limits::MAX_RESPONSES_PER_POLL));
		}

		$editToken = Random::token();
		$pollResponse = new PollResponse(
			id: Random::id(),
			pollId: $poll->id,
			editTokenHash: TokenHash::hash($editToken),
			ciphertext: $ciphertext,
			createdAt: $now,
			updatedAt: $now,
		);
		$this->responses->insert($pollResponse);

		return Json::response($response, [
			'id' => $pollResponse->id,
			'editToken' => $editToken,
			'createdAt' => $pollResponse->createdAt,
		], 201);
	}
}
