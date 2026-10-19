<?php

declare(strict_types=1);

namespace TimeLion\Tests\Database;

use PDO;
use PDOException;
use PHPUnit\Framework\TestCase;
use TimeLion\Polls\Limits;
use TimeLion\Tests\TestDatabase;

/**
 * The schema from migrations/, on whichever database TestDatabase points to (SQLite or MariaDB in CI).
 */
final class SchemaTest extends TestCase
{
	private const string POLL = '0123456789abcdef0123456789abcdef';
	private const string OTHER_POLL = 'fedcba9876543210fedcba9876543210';

	private PDO $pdo;

	protected function setUp(): void
	{
		$this->pdo = TestDatabase::migrated();
	}

	protected function tearDown(): void
	{
		unset($this->pdo);
	}

	public function testDeletingAPollDeletesItsResponses(): void
	{
		$this->insertPoll(self::POLL);
		$this->insertPoll(self::OTHER_POLL);
		$this->insertResponse('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', self::POLL);
		$this->insertResponse('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', self::POLL);
		$this->insertResponse('cccccccccccccccccccccccccccccccc', self::OTHER_POLL);

		$this->pdo->prepare('DELETE FROM polls WHERE id = ?')->execute([self::POLL]);

		self::assertSame([self::OTHER_POLL], $this->column('SELECT poll_id FROM responses'));
	}

	public function testResponseNeedsAnExistingPoll(): void
	{
		$this->expectException(PDOException::class);

		$this->insertResponse('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', self::POLL);
	}

	public function testLargestAllowedCiphertextsFit(): void
	{
		$pollCiphertext = str_repeat('p', Limits::MAX_POLL_CIPHERTEXT_BYTES);
		$responseCiphertext = str_repeat('r', Limits::MAX_RESPONSE_CIPHERTEXT_BYTES);

		$this->insertPoll(self::POLL, $pollCiphertext);
		$this->insertResponse('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', self::POLL, $responseCiphertext);

		self::assertSame([$pollCiphertext], $this->column('SELECT ciphertext FROM polls'));
		self::assertSame([$responseCiphertext], $this->column('SELECT ciphertext FROM responses'));
	}

	public function testClosedAtDefaultsToNull(): void
	{
		$this->insertPoll(self::POLL);

		self::assertSame([null], $this->column('SELECT closed_at FROM polls'));
	}

	private function insertPoll(string $id, string $ciphertext = 'v1.poll'): void
	{
		$this->pdo
			->prepare('INSERT INTO polls (id, admin_token_hash, ciphertext, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
			->execute([$id, str_repeat('0', 64), $ciphertext, 1, 1, 2]);
	}

	private function insertResponse(string $id, string $pollId, string $ciphertext = 'v1.response'): void
	{
		$this->pdo
			->prepare('INSERT INTO responses (id, poll_id, edit_token_hash, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
			->execute([$id, $pollId, str_repeat('0', 64), $ciphertext, 1, 1]);
	}

	/**
	 * @return list<mixed>
	 */
	private function column(string $sql): array
	{
		$statement = $this->pdo->query($sql);
		self::assertNotFalse($statement);

		return array_values($statement->fetchAll(PDO::FETCH_COLUMN));
	}
}
