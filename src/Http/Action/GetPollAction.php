<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\Json;
use TimeLion\Http\PollAccess;
use TimeLion\Polls\PollResponse;
use TimeLion\Repository\ResponseRepository;

/**
 * GET /api/polls/{id} – the encrypted poll with all its encrypted responses. Needs no token: the ID alone reveals
 * only ciphertext, and the key to read it is in the link fragment, which never reaches the server.
 */
final readonly class GetPollAction
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
		$poll = $this->access->poll($args['id'] ?? '', $this->clock->now());

		return Json::response($response, [
			'id' => $poll->id,
			'ciphertext' => $poll->ciphertext,
			'createdAt' => $poll->createdAt,
			'updatedAt' => $poll->updatedAt,
			'expiresAt' => $poll->expiresAt,
			'closedAt' => $poll->closedAt,
			'responses' => array_map(static fn(PollResponse $pollResponse): array => [
				'id' => $pollResponse->id,
				'ciphertext' => $pollResponse->ciphertext,
				'createdAt' => $pollResponse->createdAt,
				'updatedAt' => $pollResponse->updatedAt,
			], $this->responses->listForPoll($poll->id)),
		]);
	}
}
