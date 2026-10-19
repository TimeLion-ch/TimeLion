<?php

declare(strict_types=1);

namespace TimeLion;

use DI\Container;
use DI\ContainerBuilder;
use PDO;
use Slim\App;
use Slim\Factory\AppFactory;
use TimeLion\Database\ConnectionFactory;
use TimeLion\Database\Migrator;
use TimeLion\Deploy\DeployToken;
use TimeLion\Http\ErrorHandler;
use TimeLion\Http\Middleware\ApiHeadersMiddleware;

/**
 * Builds the Slim application: container, routes and middleware.
 */
final class Kernel
{
	public const string BASE_PATH = '/api';

	/**
	 * @return App<Container>
	 */
	public static function createApp(Config $config): App
	{
		$builder = new ContainerBuilder();
		$builder->addDefinitions([
			Config::class => $config,
			Clock::class => static fn(): Clock => new SystemClock(),
			PDO::class => static fn(Config $config): PDO => ConnectionFactory::create($config),
			Migrator::class => static fn(PDO $pdo): Migrator => new Migrator($pdo, dirname(__DIR__) . '/migrations'),
			DeployToken::class => static fn(): DeployToken => new DeployToken(dirname(__DIR__) . '/var/deploy-token'),
		]);

		$app = AppFactory::createFromContainer($builder->build());
		$app->setBasePath(self::BASE_PATH);

		Routes::register($app);

		// Slim middleware is LIFO: the last one added runs first (outermost).
		$app->addRoutingMiddleware();
		$errorMiddleware = $app->addErrorMiddleware(
			displayErrorDetails: $config->isDev(),
			logErrors: true,
			logErrorDetails: true,
		);
		$errorMiddleware->setDefaultErrorHandler(new ErrorHandler($app->getResponseFactory()));
		$app->add(new ApiHeadersMiddleware());

		return $app;
	}
}
