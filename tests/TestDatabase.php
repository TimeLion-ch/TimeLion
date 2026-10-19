<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use PDO;
use RuntimeException;
use TimeLion\Config;
use TimeLion\Database\ConnectionFactory;
use TimeLion\Database\Migrator;

/**
 * The database the tests run against: in-memory SQLite by default, or the one named by the environment variables
 * TIMELION_TEST_DSN, TIMELION_TEST_DB_USER and TIMELION_TEST_DB_PASSWORD (CI uses this for MariaDB).
 *
 * A persistent database is shared by all tests, so its schema is dropped and recreated for every test.
 */
final class TestDatabase
{
	private const string MEMORY_DSN = 'sqlite::memory:';
	private const string MIGRATIONS = __DIR__ . '/../migrations';

	private static ?PDO $shared = null;

	public static function config(string $env = Config::ENV_PROD): Config
	{
		return new Config(
			$env,
			self::env('TIMELION_TEST_DSN') ?? self::MEMORY_DSN,
			self::env('TIMELION_TEST_DB_USER'),
			self::env('TIMELION_TEST_DB_PASSWORD'),
			str_repeat('s', Config::MIN_SECRET_LENGTH),
		);
	}

	/**
	 * A connection to a database without any tables.
	 */
	public static function empty(): PDO
	{
		$config = self::config();
		if ($config->dbDsn === self::MEMORY_DSN) {
			// Every in-memory connection is its own, empty database.
			return ConnectionFactory::create($config);
		}

		$pdo = self::$shared ??= ConnectionFactory::create($config);
		self::dropAllTables($pdo);

		return $pdo;
	}

	/**
	 * A connection to a database with all migrations applied and no data.
	 */
	public static function migrated(): PDO
	{
		$pdo = self::empty();
		(new Migrator($pdo, self::MIGRATIONS))->migrate();

		return $pdo;
	}

	public static function driver(PDO $pdo): string
	{
		$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

		return is_string($driver) ? $driver : '';
	}

	private static function dropAllTables(PDO $pdo): void
	{
		if ($pdo->inTransaction()) {
			$pdo->rollBack();
		}

		[$listTables, $disableForeignKeys, $enableForeignKeys] = match (self::driver($pdo)) {
			'mysql' => [
				'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()',
				'SET FOREIGN_KEY_CHECKS = 0',
				'SET FOREIGN_KEY_CHECKS = 1',
			],
			'sqlite' => [
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
				'PRAGMA foreign_keys = OFF',
				'PRAGMA foreign_keys = ON',
			],
			default => throw new RuntimeException('Unsupported test database driver.'),
		};

		$statement = $pdo->query($listTables);
		$tables = $statement === false ? [] : $statement->fetchAll(PDO::FETCH_COLUMN);

		$pdo->exec($disableForeignKeys);
		try {
			foreach ($tables as $table) {
				if (!is_string($table) || preg_match('/^[a-z0-9_]+$/D', $table) !== 1) {
					throw new RuntimeException('Unexpected table name in the test database.');
				}
				$pdo->exec('DROP TABLE ' . $table);
			}
		} finally {
			$pdo->exec($enableForeignKeys);
		}
	}

	private static function env(string $name): ?string
	{
		$value = getenv($name);

		return is_string($value) && $value !== '' ? $value : null;
	}
}
