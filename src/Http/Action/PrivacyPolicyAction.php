<?php

declare(strict_types=1);

namespace TimeLion\Http\Action;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TimeLion\Config;
use TimeLion\Http\ApiError;
use TimeLion\Http\Json;

/**
 * GET /api/privacy-policy – the privacy policy's text from config.php, so that the operator's name and address never
 * have to be in the repository. 404 if none is configured.
 */
final readonly class PrivacyPolicyAction
{
	public function __construct(
		private Config $config,
	) {}

	public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
	{
		$text = $this->config->privacyPolicy ?? throw ApiError::notFound();

		return Json::response($response, ['text' => $text]);
	}
}
