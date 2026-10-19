<?php

declare(strict_types=1);

namespace TimeLion\Http;

use Closure;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Interfaces\ErrorHandlerInterface;
use Throwable;

/**
 * Renders every error as JSON: `{"error": {"code": "...", "message": "..."}}`.
 *
 * Only server errors (5xx) are logged, and never with request data, so logs stay free of personal data.
 */
final class ErrorHandler implements ErrorHandlerInterface
{
	private const array CODES = [
		400 => 'bad_request',
		401 => 'unauthorized',
		403 => 'forbidden',
		404 => 'not_found',
		405 => 'method_not_allowed',
		410 => 'gone',
		429 => 'too_many_requests',
		501 => 'not_implemented',
	];

	/** @var Closure(string): void */
	private readonly Closure $log;

	/**
	 * @param (Closure(string): void)|null $log defaults to error_log()
	 */
	public function __construct(
		private readonly ResponseFactoryInterface $responseFactory,
		?Closure $log = null,
	) {
		$this->log = $log ?? static function (string $message): void {
			error_log($message);
		};
	}

	public function __invoke(
		ServerRequestInterface $request,
		Throwable $exception,
		bool $displayErrorDetails,
		bool $logErrors,
		bool $logErrorDetails,
	): ResponseInterface {
		[$status, $code, $message] = self::describe($exception);

		if ($logErrors && $status >= 500) {
			($this->log)(self::formatForLog($exception, $logErrorDetails));
		}

		$error = ['code' => $code, 'message' => $message];
		if ($displayErrorDetails) {
			$error['details'] = self::exceptionChain($exception);
		}

		$response = Json::response($this->responseFactory->createResponse(), ['error' => $error], $status);
		if ($exception instanceof HttpMethodNotAllowedException) {
			$response = $response->withHeader('Allow', implode(', ', $exception->getAllowedMethods()));
		}
		if ($exception instanceof ApiError) {
			foreach ($exception->headers as $name => $value) {
				$response = $response->withHeader($name, $value);
			}
		}

		return $response;
	}

	/**
	 * @return array{int, string, string}
	 */
	private static function describe(Throwable $exception): array
	{
		if ($exception instanceof ApiError) {
			return [$exception->status, $exception->errorCode, $exception->getMessage()];
		}

		if ($exception instanceof HttpException) {
			$status = $exception->getCode();

			return [$status, self::CODES[$status] ?? ($status >= 500 ? 'internal_error' : 'bad_request'), $exception->getMessage()];
		}

		return [500, 'internal_error', 'Internal server error.'];
	}

	private static function formatForLog(Throwable $exception, bool $withTrace): string
	{
		$message = sprintf(
			'[TimeLion] %s: %s in %s:%d',
			$exception::class,
			$exception->getMessage(),
			$exception->getFile(),
			$exception->getLine(),
		);
		if (!$withTrace) {
			return $message;
		}

		// Built by hand because getTraceAsString() includes call arguments, which may contain tokens or user data.
		foreach ($exception->getTrace() as $index => $frame) {
			$message .= sprintf(
				"\n#%d %s(%s): %s%s%s()",
				$index,
				$frame['file'] ?? '[internal]',
				$frame['line'] ?? '?',
				$frame['class'] ?? '',
				$frame['type'] ?? '',
				$frame['function'],
			);
		}

		return $message;
	}

	/**
	 * @return list<array{type: string, message: string, file: string, line: int}>
	 */
	private static function exceptionChain(Throwable $exception): array
	{
		$chain = [];
		for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
			$chain[] = [
				'type' => $current::class,
				'message' => $current->getMessage(),
				'file' => $current->getFile(),
				'line' => $current->getLine(),
			];
		}

		return $chain;
	}
}
