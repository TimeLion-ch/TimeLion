<?php

declare(strict_types=1);

namespace TimeLion\Polls;

/**
 * The limits of the poll API contract (roadmap Phase 1). Sizes are bytes of the ciphertext envelope.
 */
final class Limits
{
	/** 64 KiB. polls.ciphertext is MEDIUMTEXT because this is one byte more than TEXT holds. */
	public const int MAX_POLL_CIPHERTEXT_BYTES = 64 * 1024;

	/** 16 KiB. */
	public const int MAX_RESPONSE_CIPHERTEXT_BYTES = 16 * 1024;

	/** 80 KiB: room for the largest ciphertext plus the JSON around it. */
	public const int MAX_BODY_BYTES = 80 * 1024;

	public const int MAX_RESPONSES_PER_POLL = 500;

	/** Seconds: `expiresAt` may be at most this far in the future (decision D7: 365 days). */
	public const int MAX_LIFETIME = 365 * 24 * 60 * 60;
}
