<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use PDO;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Http\Json;

/**
 * GET /api/health – used by the deployment smoke test. Fails with 500 if the database is unreachable.
 */
final readonly class HealthAction
{
	public function __construct(
		private PDO $pdo,
	) {}

	public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
	{
		$this->pdo->query('SELECT 1');

		return Json::response($response, ['status' => 'ok']);
	}
}
