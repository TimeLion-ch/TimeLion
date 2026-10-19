<?php

declare(strict_types=1);

namespace TimeLion\Repository;

use PDO;
use TimeLion\Polls\PollResponse;

/**
 * Responses are always looked up together with their poll's ID, so one poll's ID never reaches another's responses.
 */
final readonly class ResponseRepository
{
	private const string COLUMNS = 'id, poll_id, edit_token_hash, ciphertext, created_at, updated_at';

	public function __construct(
		private PDO $pdo,
	) {}

	public function insert(PollResponse $response): void
	{
		$this->pdo
			->prepare('INSERT INTO responses (' . self::COLUMNS . ') VALUES (?, ?, ?, ?, ?, ?)')
			->execute([
				$response->id,
				$response->pollId,
				$response->editTokenHash,
				$response->ciphertext,
				$response->createdAt,
				$response->updatedAt,
			]);
	}

	public function find(string $pollId, string $id): ?PollResponse
	{
		$statement = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM responses WHERE id = ? AND poll_id = ?');
		$statement->execute([$id, $pollId]);
		$row = $statement->fetch();

		return is_array($row) ? self::hydrate($row) : null;
	}

	/**
	 * @return list<PollResponse> oldest first; responses created in the same second are ordered by ID
	 */
	public function listForPoll(string $pollId): array
	{
		$statement = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM responses WHERE poll_id = ? ORDER BY created_at, id');
		$statement->execute([$pollId]);

		$responses = [];
		foreach ($statement->fetchAll() as $row) {
			if (is_array($row)) {
				$responses[] = self::hydrate($row);
			}
		}

		return $responses;
	}

	public function countForPoll(string $pollId): int
	{
		$statement = $this->pdo->prepare('SELECT COUNT(*) AS n FROM responses WHERE poll_id = ?');
		$statement->execute([$pollId]);
		$row = $statement->fetch();

		return Row::int(is_array($row) ? $row : [], 'n');
	}

	/**
	 * Writes the mutable columns: ciphertext and updated_at.
	 */
	public function update(PollResponse $response): void
	{
		$this->pdo
			->prepare('UPDATE responses SET ciphertext = ?, updated_at = ? WHERE id = ? AND poll_id = ?')
			->execute([$response->ciphertext, $response->updatedAt, $response->id, $response->pollId]);
	}

	public function delete(string $pollId, string $id): void
	{
		$this->pdo->prepare('DELETE FROM responses WHERE id = ? AND poll_id = ?')->execute([$id, $pollId]);
	}

	/**
	 * @param array<mixed> $row
	 */
	private static function hydrate(array $row): PollResponse
	{
		return new PollResponse(
			id: Row::string($row, 'id'),
			pollId: Row::string($row, 'poll_id'),
			editTokenHash: Row::string($row, 'edit_token_hash'),
			ciphertext: Row::string($row, 'ciphertext'),
			createdAt: Row::int($row, 'created_at'),
			updatedAt: Row::int($row, 'updated_at'),
		);
	}
}
