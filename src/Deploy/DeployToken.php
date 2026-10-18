<?php

declare(strict_types=1);

namespace TimeLion\Deploy;

use RuntimeException;

/**
 * The one-time token that authorizes POST /api/deploy/migrate on hosts without a shell.
 *
 * The deploy job generates a random token, uploads its SHA-256 hash to var/deploy-token over FTP and calls the
 * endpoint with the token. The file is deleted on first use, so between deploys there is nothing to match.
 */
final readonly class DeployToken
{
	public function __construct(
		private string $path,
	) {}

	/**
	 * @return string|null the SHA-256 hex hash of the pending token, or null if no deploy is pending
	 */
	public function pendingHash(): ?string
	{
		if (!is_file($this->path)) {
			return null;
		}

		$hash = trim((string) file_get_contents($this->path));
		if (preg_match('/^[0-9a-f]{64}$/', $hash) !== 1) {
			throw new RuntimeException('The deploy token file does not contain a SHA-256 hex hash.');
		}

		return $hash;
	}

	/**
	 * Deletes the token file. Only one request can succeed, so the token works exactly once.
	 */
	public function consume(): void
	{
		if (!@unlink($this->path)) {
			throw new RuntimeException('The deploy token file could not be deleted, so the token was not accepted.');
		}
	}
}
