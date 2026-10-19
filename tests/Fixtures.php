<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use TimeLion\Polls\Poll;
use TimeLion\Polls\PollResponse;
use TimeLion\Security\Random;
use TimeLion\Security\TokenHash;

/**
 * Builders for stored polls and responses with valid defaults.
 */
final class Fixtures
{
	public const string IV = 'AAECAwQFBgcICQoL';

	/**
	 * A well-formed ciphertext envelope; $fill makes different ones distinguishable.
	 */
	public static function ciphertext(string $fill = 'A', int $length = 24): string
	{
		return 'v1.' . self::IV . '.' . str_repeat($fill, $length);
	}

	public static function poll(
		?string $id = null,
		string $adminToken = 'admin-token',
		?string $ciphertext = null,
		int $createdAt = 1_800_000_000,
		?int $updatedAt = null,
		?int $expiresAt = null,
		?int $closedAt = null,
	): Poll {
		return new Poll(
			id: $id ?? Random::id(),
			adminTokenHash: TokenHash::hash($adminToken),
			ciphertext: $ciphertext ?? self::ciphertext('P'),
			createdAt: $createdAt,
			updatedAt: $updatedAt ?? $createdAt,
			expiresAt: $expiresAt ?? $createdAt + 30 * 86400,
			closedAt: $closedAt,
		);
	}

	public static function response(
		string $pollId,
		?string $id = null,
		string $editToken = 'edit-token',
		?string $ciphertext = null,
		int $createdAt = 1_800_000_000,
		?int $updatedAt = null,
	): PollResponse {
		return new PollResponse(
			id: $id ?? Random::id(),
			pollId: $pollId,
			editTokenHash: TokenHash::hash($editToken),
			ciphertext: $ciphertext ?? self::ciphertext('R'),
			createdAt: $createdAt,
			updatedAt: $updatedAt ?? $createdAt,
		);
	}
}
