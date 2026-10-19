<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Clock;
use TimeLion\Http\PollAccess;
use TimeLion\Repository\ResponseRepository;
use TimeLion\Security\RateLimit;
use TimeLion\Security\RateLimiter;

/**
 * DELETE /api/polls/{id}/responses/{responseId} – the participant (edit token) or the admin (admin token) removes a
 * response. Allowed on closed polls too, so nobody's response is stuck there.
 */
final readonly class DeleteResponseAction
{
	public function __construct(
		private RateLimiter $rateLimiter,
		private PollAccess $access,
		private ResponseRepository $responses,
		private Clock $clock,
	) {}

	/**
	 * @param array<string, string> $args
	 */
	public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
	{
		$this->rateLimiter->hit(RateLimit::WriteResponse, $request);
		[$poll, $existing] = $this->access->responseForEditorOrAdmin($request, $args['id'] ?? '', $args['responseId'] ?? '', $this->clock->now());
		$this->responses->delete($poll->id, $existing->id);

		return $response->withStatus(204);
	}
}
