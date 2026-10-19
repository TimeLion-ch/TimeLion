<?php

declare(strict_types=1);

namespace TimeLion\Security;

/**
 * The rate-limited actions and their limits per client IP and fixed one-hour window.
 */
enum RateLimit: string
{
	case CreatePoll = 'create_poll';
	case WriteResponse = 'write_response';
	case AdminWrite = 'admin_write';

	/** Seconds. Windows start at full UTC hours. */
	public const int WINDOW = 3600;

	public function perWindow(): int
	{
		return match ($this) {
			self::CreatePoll => 20,
			self::WriteResponse => 60,
			self::AdminWrite => 120,
		};
	}
}
