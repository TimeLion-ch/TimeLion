<?php

declare(strict_types=1);

namespace TimeLion;

use DI\Container;
use Slim\App;
use TimeLion\Http\Action\CreatePollAction;
use TimeLion\Http\Action\CreateResponseAction;
use TimeLion\Http\Action\DeletePollAction;
use TimeLion\Http\Action\DeleteResponseAction;
use TimeLion\Http\Action\DeployMigrateAction;
use TimeLion\Http\Action\GetPollAction;
use TimeLion\Http\Action\HealthAction;
use TimeLion\Http\Action\PrivacyPolicyAction;
use TimeLion\Http\Action\UpdatePollAction;
use TimeLion\Http\Action\UpdateResponseAction;

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
		$app->get('/privacy-policy', PrivacyPolicyAction::class);

		$app->post('/polls', CreatePollAction::class);
		$app->get('/polls/{id}', GetPollAction::class);
		$app->patch('/polls/{id}', UpdatePollAction::class);
		$app->delete('/polls/{id}', DeletePollAction::class);

		$app->post('/polls/{id}/responses', CreateResponseAction::class);
		$app->put('/polls/{id}/responses/{responseId}', UpdateResponseAction::class);
		$app->delete('/polls/{id}/responses/{responseId}', DeleteResponseAction::class);
	}
}
