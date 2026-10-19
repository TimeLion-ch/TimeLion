<?php

declare(strict_types=1);

namespace TimeLion\Repository;

use PDO;
use TimeLion\Polls\Poll;

final readonly class PollRepository
{
	private const string COLUMNS = 'id, admin_token_hash, ciphertext, created_at, updated_at, expires_at, closed_at';

	public function __construct(
		private PDO $pdo,
	) {}

	public function insert(Poll $poll): void
	{
		$this->pdo
			->prepare('INSERT INTO polls (' . self::COLUMNS . ') VALUES (?, ?, ?, ?, ?, ?, ?)')
			->execute([
				$poll->id,
				$poll->adminTokenHash,
				$poll->ciphertext,
				$poll->createdAt,
				$poll->updatedAt,
				$poll->expiresAt,
				$poll->closedAt,
			]);
	}

	/**
	 * @param int $now Unix seconds: polls that expire at or before this time are treated as gone
	 */
	public function findActive(string $id, int $now): ?Poll
	{
		$statement = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM polls WHERE id = ? AND expires_at > ?');
		$statement->execute([$id, $now]);
		$row = $statement->fetch();

		return is_array($row) ? self::hydrate($row) : null;
	}

	/**
	 * Writes the mutable columns: ciphertext, updated_at, expires_at and closed_at.
	 */
	public function update(Poll $poll): void
	{
		$this->pdo
			->prepare('UPDATE polls SET ciphertext = ?, updated_at = ?, expires_at = ?, closed_at = ? WHERE id = ?')
			->execute([$poll->ciphertext, $poll->updatedAt, $poll->expiresAt, $poll->closedAt, $poll->id]);
	}

	/**
	 * Deletes the poll; the foreign key deletes its responses.
	 */
	public function delete(string $id): void
	{
		$this->pdo->prepare('DELETE FROM polls WHERE id = ?')->execute([$id]);
	}

	/**
	 * @param array<mixed> $row
	 */
	private static function hydrate(array $row): Poll
	{
		return new Poll(
			id: Row::string($row, 'id'),
			adminTokenHash: Row::string($row, 'admin_token_hash'),
			ciphertext: Row::string($row, 'ciphertext'),
			createdAt: Row::int($row, 'created_at'),
			updatedAt: Row::int($row, 'updated_at'),
			expiresAt: Row::int($row, 'expires_at'),
			closedAt: Row::nullableInt($row, 'closed_at'),
		);
	}
}
