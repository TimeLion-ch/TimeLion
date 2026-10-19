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

/**
 * PUT /api/polls/{id}/responses/{responseId} – the participant replaces their response, with its edit token.
 */
final readonly class UpdateResponseAction
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
		[$poll, $existing] = $this->access->responseForEditor($request, $args['id'] ?? '', $args['responseId'] ?? '', $now);
		$body = Json::decodeBody($request, Limits::MAX_BODY_BYTES);
		$ciphertext = Validate::ciphertext($body['ciphertext'] ?? null, Limits::MAX_RESPONSE_CIPHERTEXT_BYTES);

		if ($poll->closedAt !== null) {
			throw ApiError::conflict('poll_closed', 'This poll is closed.');
		}

		$updated = new PollResponse($existing->id, $existing->pollId, $existing->editTokenHash, $ciphertext, $existing->createdAt, $now);
		$this->responses->update($updated);

		return Json::response($response, ['id' => $updated->id, 'updatedAt' => $updated->updatedAt]);
	}
}
