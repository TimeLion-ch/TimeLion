<?php

declare(strict_types=1);

namespace TimeLion\Http\Middleware;

use Closure;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Throwable;
use TimeLion\Maintenance\Purger;

/**
 * Purges expired data after about one in fifty successful API requests, because shared hosting may have no cron.
 * A failed purge is logged and never fails the request.
 */
final readonly class PurgeMiddleware implements MiddlewareInterface
{
	/** Purge after one in this many requests (2%). */
	public const int ONE_IN = 50;

	/** @var Closure(): bool */
	private Closure $shouldPurge;

	/** @var Closure(string): void */
	private Closure $log;

	/**
	 * @param (Closure(): bool)|null $shouldPurge defaults to a 1-in-ONE_IN chance
	 * @param (Closure(string): void)|null $log defaults to error_log()
	 */
	public function __construct(
		private Purger $purger,
		?Closure $shouldPurge = null,
		?Closure $log = null,
	) {
		$this->shouldPurge = $shouldPurge ?? static fn(): bool => random_int(1, self::ONE_IN) === 1;
		$this->log = $log ?? static function (string $message): void {
			error_log($message);
		};
	}

	public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
	{
		$response = $handler->handle($request);

		if (($this->shouldPurge)()) {
			try {
				$this->purger->purge();
			} catch (Throwable $exception) {
				// The message comes from PDO and the SQL; statements are prepared, so it holds no values.
				($this->log)(sprintf('[TimeLion] Purge failed: %s: %s', $exception::class, $exception->getMessage()));
			}
		}

		return $response;
	}
}
