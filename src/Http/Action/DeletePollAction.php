<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\PollAccess;
use TimeLion\Repository\PollRepository;

/**
 * DELETE /api/polls/{id} – the admin deletes the poll and, through the foreign key, all its responses.
 */
final readonly class DeletePollAction
{
	public function __construct(
		private PollAccess $access,
		private PollRepository $polls,
		private Clock $clock,
	) {}

	/**
	 * @param array<string, string> $args
	 */
	public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
	{
		$poll = $this->access->pollForAdmin($request, $args['id'] ?? '', $this->clock->now());
		$this->polls->delete($poll->id);

		return $response->withStatus(204);
	}
}
