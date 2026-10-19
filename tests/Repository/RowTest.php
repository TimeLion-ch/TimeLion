<?php

declare(strict_types=1);

namespace TimeLion\Tests\Repository;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use TimeLion\Repository\Row;
use UnexpectedValueException;

final class RowTest extends TestCase
{
	public function testReadsNativeAndStringIntegers(): void
	{
		$row = ['a' => 42, 'b' => '1800000000', 'c' => '-5', 'd' => null, 's' => 'text'];

		self::assertSame(42, Row::int($row, 'a'));
		self::assertSame(1_800_000_000, Row::int($row, 'b'));
		self::assertSame(-5, Row::int($row, 'c'));
		self::assertNull(Row::nullableInt($row, 'd'));
		self::assertSame('text', Row::string($row, 's'));
	}

	/**
	 * @return iterable<string, array{callable(): mixed}>
	 */
	public static function invalidReads(): iterable
	{
		yield 'missing string' => [static fn(): string => Row::string([], 'x')];
		yield 'integer as string' => [static fn(): string => Row::string(['x' => 1], 'x')];
		yield 'null as int' => [static fn(): int => Row::int(['x' => null], 'x')];
		yield 'decimal string as int' => [static fn(): ?int => Row::nullableInt(['x' => '1.5'], 'x')];
		yield 'text as int' => [static fn(): ?int => Row::nullableInt(['x' => '12abc'], 'x')];
		yield 'float as int' => [static fn(): ?int => Row::nullableInt(['x' => 1.0], 'x')];
	}

	/**
	 * @param callable(): mixed $read
	 */
	#[DataProvider('invalidReads')]
	public function testRejectsUnexpectedValues(callable $read): void
	{
		$this->expectException(UnexpectedValueException::class);

		$read();
	}
}
