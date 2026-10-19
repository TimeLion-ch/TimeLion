<?php

declare(strict_types=1);

namespace TimeLion\Polls;

/**
 * A stored poll. The server only knows ciphertext, the admin token's hash and timestamps (Unix seconds).
 */
final readonly class Poll
{
	public function __construct(
		public string $id,
		public string $adminTokenHash,
		public string $ciphertext,
		public int $createdAt,
		public int $updatedAt,
		public int $expiresAt,
		public ?int $closedAt,
	) {}
}
