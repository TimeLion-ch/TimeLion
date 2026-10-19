<?php

declare(strict_types=1);

namespace TimeLion\Repository;

use UnexpectedValueException;

/**
 * Typed access to fetched rows. PDO returns integers natively or as strings, depending on driver and statement.
 */
final class Row
{
	/**
	 * @param array<mixed> $row
	 */
	public static function string(array $row, string $column): string
	{
		$value = $row[$column] ?? null;
		if (!is_string($value)) {
			throw new UnexpectedValueException(sprintf('Column "%s" is not a string.', $column));
		}

		return $value;
	}

	/**
	 * @param array<mixed> $row
	 */
	public static function int(array $row, string $column): int
	{
		return self::nullableInt($row, $column) ?? throw new UnexpectedValueException(sprintf('Column "%s" is null.', $column));
	}

	/**
	 * @param array<mixed> $row
	 */
	public static function nullableInt(array $row, string $column): ?int
	{
		$value = $row[$column] ?? null;
		if ($value === null || is_int($value)) {
			return $value;
		}
		if (is_string($value) && preg_match('/^-?\d+$/D', $value) === 1) {
			return (int) $value;
		}

		throw new UnexpectedValueException(sprintf('Column "%s" is not an integer.', $column));
	}
}
