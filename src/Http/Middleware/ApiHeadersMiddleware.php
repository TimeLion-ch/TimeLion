<?php

declare(strict_types=1);

namespace TimeLion\Http\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Security and caching headers for every API response, including errors.
 * The web server (.htaccess) sets the page headers; these also apply when no .htaccess is used.
 */
final class ApiHeadersMiddleware implements MiddlewareInterface
{
	public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
	{
		return $handler->handle($request)
			->withHeader('Cache-Control', 'no-store')
			->withHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
			->withHeader('Referrer-Policy', 'no-referrer')
			->withHeader('X-Content-Type-Options', 'nosniff')
			->withHeader('X-Robots-Tag', 'noindex');
	}
}
