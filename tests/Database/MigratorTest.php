<?php

declare(strict_types=1);

namespace TimeLion\Tests\Database;

use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use TimeLion\Config;
use TimeLion\Database\ConnectionFactory;
use TimeLion\Database\Migrator;
use TimeLion\Tests\TestDatabase;

final class MigratorTest extends TestCase
{
	private const string FIXTURES = __DIR__ . '/../fixtures/migrations';

	private PDO $pdo;

	protected function setUp(): void
	{
		$this->pdo = TestDatabase::empty();
	}

	protected function tearDown(): void
	{
		unset($this->pdo);
	}

	public function testAppliesPendingMigrationsInOrder(): void
	{
		$migrator = new Migrator($this->pdo, self::FIXTURES);

		self::assertSame(['0001_create_things', '0002_add_thing_tags'], $migrator->pending());
		self::assertSame(['0001_create_things', '0002_add_thing_tags'], $migrator->migrate());
		self::assertSame([], $migrator->pending());
		self::assertSame(['0001_create_things', '0002_add_thing_tags'], $migrator->applied());

		$this->pdo->exec("INSERT INTO things (id, name) VALUES ('a', 'first')");
		$this->pdo->exec("INSERT INTO thing_tags (thing_id, tag) VALUES ('a', 'x')");
		self::assertSame([['tag' => 'x']], $this->fetchAll('SELECT tag FROM thing_tags'));
	}

	public function testMigrateIsIdempotent(): void
	{
		$migrator = new Migrator($this->pdo, self::FIXTURES);
		$migrator->migrate();

		self::assertSame([], $migrator->migrate());
	}

	public function testRealMigrationsApplyCleanly(): void
	{
		$migrator = new Migrator($this->pdo, dirname(__DIR__, 2) . '/migrations');
		$migrator->migrate();

		self::assertSame([], $migrator->pending());
	}

	public function testFailedSqliteMigrationIsRolledBack(): void
	{
		// MySQL commits DDL implicitly, so this is about SQLite whichever database the other tests use.
		$this->pdo = ConnectionFactory::create(new Config('prod', 'sqlite::memory:', null, null, str_repeat('s', 32)));
		$directory = sys_get_temp_dir() . '/timelion-migrations-' . bin2hex(random_bytes(4));
		mkdir($directory);
		file_put_contents($directory . '/0001_broken.sql', "CREATE TABLE ok_table (id INTEGER);\nTHIS IS NOT SQL;\n");

		try {
			(new Migrator($this->pdo, $directory))->migrate();
			self::fail('Expected RuntimeException');
		} catch (RuntimeException $exception) {
			self::assertStringContainsString('0001_broken', $exception->getMessage());
		} finally {
			unlink($directory . '/0001_broken.sql');
			rmdir($directory);
		}

		self::assertSame([], $this->fetchAll("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ok_table'"));
	}

	public function testRejectsBadFilenames(): void
	{
		$directory = sys_get_temp_dir() . '/timelion-migrations-' . bin2hex(random_bytes(4));
		mkdir($directory);
		file_put_contents($directory . '/create-things.sql', 'SELECT 1;');

		try {
			$this->expectException(RuntimeException::class);
			$this->expectExceptionMessage('create-things.sql');
			(new Migrator($this->pdo, $directory))->available();
		} finally {
			unlink($directory . '/create-things.sql');
			rmdir($directory);
		}
	}

	public function testSplitStatements(): void
	{
		$sql = <<<'SQL'
			-- A comment; with a semicolon
			CREATE TABLE a (id INTEGER);

			CREATE TABLE b (
				id INTEGER
			);
			SQL;

		self::assertSame(
			['CREATE TABLE a (id INTEGER)', "CREATE TABLE b (\n\tid INTEGER\n)"],
			Migrator::splitStatements($sql),
		);
	}

	/**
	 * @return list<mixed>
	 */
	private function fetchAll(string $sql): array
	{
		$statement = $this->pdo->query($sql);
		self::assertNotFalse($statement);

		return array_values($statement->fetchAll());
	}
}
