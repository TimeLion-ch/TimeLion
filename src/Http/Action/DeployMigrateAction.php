<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use RuntimeException;
use TimeLion\Database\Migrator;
use TimeLion\Deploy\DeployToken;
use TimeLion\Http\ApiError;
use TimeLion\Http\BearerToken;
use TimeLion\Http\Json;
use TimeLion\Security\TokenHash;

/**
 * POST /api/deploy/migrate – applies pending migrations during an FTP deploy, where bin/migrate.php cannot run.
 *
 * Answers 404 unless a deploy is pending (see DeployToken), so the endpoint does not exist between deploys.
 */
final readonly class DeployMigrateAction
{
	public function __construct(
		private DeployToken $deployToken,
		private Migrator $migrator,
	) {}

	public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
	{
		$hash = $this->deployToken->pendingHash() ?? throw ApiError::notFound();
		if (!TokenHash::matches(BearerToken::fromRequest($request), $hash)) {
			throw ApiError::forbidden();
		}
		try {
			$this->deployToken->consume();
			$applied = $this->migrator->migrate();
		} catch (RuntimeException $exception) {
			// Only the deploy job gets this far, and without a shell its log is the only place to read the reason.
			// These messages come from the token file and the migrations, never from user data.
			throw new ApiError(500, 'migration_failed', $exception->getMessage(), $exception);
		}

		return Json::response($response, ['applied' => $applied]);
	}
}
