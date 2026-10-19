<?php

declare(strict_types=1);

namespace TimeLion;

use InvalidArgumentException;
use RuntimeException;

/**
 * Typed application configuration, loaded from config.php (outside the web root).
 */
final readonly class Config
{
	public const string ENV_DEV = 'dev';
	public const string ENV_PROD = 'prod';

	public const int MIN_SECRET_LENGTH = 32;

	/**
	 * @param string|null $trustedProxyHeader the header a reverse proxy passes the client IP in (see config.example.php)
	 * @param string|null $privacyPolicy the privacy policy's text (format: frontend/src/lib/markup.ts), or null for none
	 */
	public function __construct(
		public string $env,
		public string $dbDsn,
		public ?string $dbUser,
		public ?string $dbPassword,
		public string $secret,
		public ?string $trustedProxyHeader = null,
		public ?string $privacyPolicy = null,
	) {
		if (!in_array($env, [self::ENV_DEV, self::ENV_PROD], true)) {
			throw new InvalidArgumentException(sprintf('Config "env" must be "%s" or "%s".', self::ENV_DEV, self::ENV_PROD));
		}
		if ($dbDsn === '') {
			throw new InvalidArgumentException('Config "db.dsn" must not be empty.');
		}
		if (strlen($secret) < self::MIN_SECRET_LENGTH) {
			throw new InvalidArgumentException(sprintf('Config "secret" must be at least %d characters long.', self::MIN_SECRET_LENGTH));
		}
		if ($trustedProxyHeader !== null && preg_match('/^[A-Za-z0-9-]+$/D', $trustedProxyHeader) !== 1) {
			throw new InvalidArgumentException('Config "trusted_proxy_header" must be a header name such as "X-Forwarded-For", or null.');
		}
		// UTF-8, or the API couldn't encode it as JSON.
		if ($privacyPolicy !== null && (trim($privacyPolicy) === '' || preg_match('//u', $privacyPolicy) !== 1)) {
			throw new InvalidArgumentException('Config "privacy_policy" must be UTF-8 text, or null.');
		}
	}

	/**
	 * Loads the file named by the TIMELION_CONFIG environment variable, or config.php in the project root.
	 */
	public static function load(): self
	{
		$path = getenv('TIMELION_CONFIG');

		return self::fromFile(is_string($path) && $path !== '' ? $path : dirname(__DIR__) . '/config.php');
	}

	public static function fromFile(string $path): self
	{
		if (!is_file($path)) {
			throw new RuntimeException(sprintf('Configuration file "%s" not found. Copy config.example.php to config.php.', $path));
		}

		$values = require $path;
		if (!is_array($values)) {
			throw new InvalidArgumentException(sprintf('Configuration file "%s" must return an array.', $path));
		}

		return self::fromArray($values);
	}

	/**
	 * @param array<mixed> $values
	 */
	public static function fromArray(array $values): self
	{
		$db = $values['db'] ?? null;
		if (!is_array($db)) {
			throw new InvalidArgumentException('Config "db" must be an array.');
		}

		return new self(
			env: self::string($values, 'env', 'env'),
			dbDsn: self::string($db, 'dsn', 'db.dsn'),
			dbUser: self::nullableString($db, 'user', 'db.user'),
			dbPassword: self::nullableString($db, 'password', 'db.password'),
			secret: self::string($values, 'secret', 'secret'),
			trustedProxyHeader: self::nullableString($values, 'trusted_proxy_header', 'trusted_proxy_header'),
			privacyPolicy: self::nullableString($values, 'privacy_policy', 'privacy_policy'),
		);
	}

	public function isDev(): bool
	{
		return $this->env === self::ENV_DEV;
	}

	/**
	 * @param array<mixed> $values
	 */
	private static function string(array $values, string $key, string $name): string
	{
		$value = $values[$key] ?? null;
		if (!is_string($value)) {
			throw new InvalidArgumentException(sprintf('Config "%s" must be a string.', $name));
		}

		return $value;
	}

	/**
	 * @param array<mixed> $values
	 */
	private static function nullableString(array $values, string $key, string $name): ?string
	{
		$value = $values[$key] ?? null;
		if ($value !== null && !is_string($value)) {
			throw new InvalidArgumentException(sprintf('Config "%s" must be a string or null.', $name));
		}

		return $value;
	}
}
