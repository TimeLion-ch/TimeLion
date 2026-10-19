<?php

declare(strict_types=1);

namespace TimeLion\Polls;

/**
 * A stored response to a poll (one participant's encrypted name, votes and comment).
 */
final readonly class PollResponse
{
	public function __construct(
		public string $id,
		public string $pollId,
		public string $editTokenHash,
		public string $ciphertext,
		public int $createdAt,
		public int $updatedAt,
	) {}
}
