<?php

declare(strict_types=1);

namespace TimeLion\Repository;

use PDO;
use PDOException;

final readonly class RateLimitRepository
{
	private const string INTEGRITY_CONSTRAINT_VIOLATION = '23000';

	public function __construct(
		private PDO $pdo,
	) {}

	/**
	 * Counts one request in the bucket's current window.
	 *
	 * @return int the requests counted in this window, including this one
	 */
	public function hit(string $bucket, int $windowStart): int
	{
		$increment = $this->pdo->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ? AND window_start = ?');
		$increment->execute([$bucket, $windowStart]);

		if ($increment->rowCount() === 0) {
			// The first request in this window: restart the bucket's row from an earlier window, or create it.
			$restart = $this->pdo->prepare('UPDATE rate_limits SET window_start = ?, hits = 1 WHERE bucket = ? AND window_start < ?');
			$restart->execute([$windowStart, $bucket, $windowStart]);

			if ($restart->rowCount() === 0) {
				try {
					$this->pdo
						->prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)')
						->execute([$bucket, $windowStart]);
				} catch (PDOException $exception) {
					// A concurrent request created the row first, so count this one there.
					if (($exception->errorInfo[0] ?? null) !== self::INTEGRITY_CONSTRAINT_VIOLATION) {
						throw $exception;
					}
					$increment->execute([$bucket, $windowStart]);
				}
			}
		}

		$select = $this->pdo->prepare('SELECT hits FROM rate_limits WHERE bucket = ?');
		$select->execute([$bucket]);
		$row = $select->fetch();

		return Row::int(is_array($row) ? $row : [], 'hits');
	}

	/**
	 * Deletes the rows of windows that started before $windowStart: they no longer limit anything.
	 *
	 * @return int the number of rows deleted
	 */
	public function deleteBefore(int $windowStart): int
	{
		$statement = $this->pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?');
		$statement->execute([$windowStart]);

		return $statement->rowCount();
	}
}
