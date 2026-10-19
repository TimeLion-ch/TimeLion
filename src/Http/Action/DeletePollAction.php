<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\PollAccess;
use TimeLion\Repository\PollRepository;
use TimeLion\Security\RateLimit;
use TimeLion\Security\RateLimiter;

/**
 * DELETE /api/polls/{id} – the admin deletes the poll and, through the foreign key, all its responses.
 */
final readonly class DeletePollAction
{
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
		$poll = $this->access->pollForAdmin($request, $args['id'] ?? '', $this->clock->now());
		$this->polls->delete($poll->id);

		return $response->withStatus(204);
	}
}
