<?php

declare(strict_types=1);

namespace TimeLion\Database;

use PDO;
use RuntimeException;
use Throwable;

/**
 * Applies the numbered SQL files in migrations/ in order and records them in `schema_migrations`.
 *
 * Migration files are named `NNNN_description.sql`, contain portable SQL (SQLite and MySQL/MariaDB)
 * and end every statement with `;` at the end of a line. Applied migrations must never be edited.
 */
final class Migrator
{
	private const string FILENAME_PATTERN = '/^\d{4}_[a-z0-9_]+\.sql$/D';

	public function __construct(
		private readonly PDO $pdo,
		private readonly string $directory,
	) {}

	/**
	 * @return list<string> versions (filenames without .sql), sorted
	 */
	public function available(): array
	{
		$files = scandir($this->directory);
		if ($files === false) {
			throw new RuntimeException(sprintf('Migrations directory "%s" is not readable.', $this->directory));
		}

		$versions = [];
		foreach ($files as $file) {
			if (!str_ends_with($file, '.sql')) {
				continue;
			}
			if (preg_match(self::FILENAME_PATTERN, $file) !== 1) {
				throw new RuntimeException(sprintf('Invalid migration filename "%s". Expected NNNN_description.sql.', $file));
			}
			$versions[] = substr($file, 0, -4);
		}
		sort($versions, SORT_STRING);

		return $versions;
	}

	/**
	 * @return list<string>
	 */
	public function applied(): array
	{
		$this->ensureMigrationsTable();

		$versions = [];
		foreach ($this->pdo->query('SELECT version FROM schema_migrations ORDER BY version') ?: [] as $row) {
			if (is_array($row) && is_string($row['version'] ?? null)) {
				$versions[] = $row['version'];
			}
		}

		return $versions;
	}

	/**
	 * @return list<string>
	 */
	public function pending(): array
	{
		return array_values(array_diff($this->available(), $this->applied()));
	}

	/**
	 * Applies all pending migrations.
	 *
	 * @return list<string> the versions that were applied
	 */
	public function migrate(): array
	{
		$pending = $this->pending();
		foreach ($pending as $version) {
			$this->apply($version);
		}

		return $pending;
	}

	/**
	 * Splits a migration file into single statements.
	 *
	 * @return list<string>
	 */
	public static function splitStatements(string $sql): array
	{
		$withoutComments = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
		$parts = preg_split('/;\s*$/m', $withoutComments) ?: [];

		return array_values(array_filter(array_map(trim(...), $parts), static fn(string $statement): bool => $statement !== ''));
	}

	private function apply(string $version): void
	{
		$sql = file_get_contents($this->directory . '/' . $version . '.sql');
		if ($sql === false) {
			throw new RuntimeException(sprintf('Migration "%s" is not readable.', $version));
		}

		// MySQL commits implicitly on DDL, so transactions only protect SQLite migrations.
		$transactional = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
		if ($transactional) {
			$this->pdo->beginTransaction();
		}

		try {
			foreach (self::splitStatements($sql) as $statement) {
				$this->pdo->exec($statement);
			}
			$insert = $this->pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
			$insert->execute([$version, time()]);
			if ($transactional) {
				$this->pdo->commit();
			}
		} catch (Throwable $exception) {
			if ($transactional && $this->pdo->inTransaction()) {
				$this->pdo->rollBack();
			}
			throw new RuntimeException(sprintf('Migration "%s" failed: %s', $version, $exception->getMessage()), 0, $exception);
		}
	}

	private function ensureMigrationsTable(): void
	{
		$this->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at BIGINT NOT NULL)');
	}
}
