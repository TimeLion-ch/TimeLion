<?php

declare(strict_types=1);

namespace TimeLion;

use DI\Container;
use Slim\App;
use TimeLion\Http\Action\CreatePollAction;
use TimeLion\Http\Action\DeployMigrateAction;
use TimeLion\Http\Action\HealthAction;

/**
 * All API routes. Paths are relative to Kernel::BASE_PATH (/api).
 * Document every route in docs/api.md.
 */
final class Routes
{
	/**
	 * @param App<Container> $app
	 */
	public static function register(App $app): void
	{
		$app->get('/health', HealthAction::class);
		$app->post('/deploy/migrate', DeployMigrateAction::class);

		$app->post('/polls', CreatePollAction::class);
	}
}
