<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use TimeLion\Config;

final class ConfigTest extends TestCase
{
	public function testFromArray(): void
	{
		$config = Config::fromArray(self::valid());

		self::assertSame('prod', $config->env);
		self::assertSame('sqlite::memory:', $config->dbDsn);
		self::assertNull($config->dbUser);
		self::assertFalse($config->isDev());
	}

	public function testExampleConfigIsValidOnceSecretIsSet(): void
	{
		$values = require dirname(__DIR__) . '/config.example.php';
		self::assertIsArray($values);
		$values['secret'] = str_repeat('a', 64);

		self::assertSame('prod', Config::fromArray($values)->env);
	}

	/**
	 * @return iterable<string, array{array<mixed>, string}>
	 */
	public static function invalidConfigs(): iterable
	{
		yield 'unknown env' => [['env' => 'staging'] + self::valid(), '"env"'];
		yield 'missing db' => [['db' => null] + self::valid(), '"db"'];
		yield 'empty dsn' => [['db' => ['dsn' => '']] + self::valid(), '"db.dsn"'];
		yield 'non-string user' => [['db' => ['dsn' => 'sqlite::memory:', 'user' => 5]] + self::valid(), '"db.user"'];
		yield 'short secret' => [['secret' => 'too-short'] + self::valid(), '"secret"'];
		yield 'missing secret' => [['secret' => null] + self::valid(), '"secret"'];
	}

	/**
	 * @param array<mixed> $values
	 */
	#[DataProvider('invalidConfigs')]
	public function testRejectsInvalidConfig(array $values, string $mentions): void
	{
		$this->expectException(InvalidArgumentException::class);
		$this->expectExceptionMessage($mentions);

		Config::fromArray($values);
	}

	public function testMissingFileExplainsWhatToDo(): void
	{
		$this->expectException(RuntimeException::class);
		$this->expectExceptionMessage('config.example.php');

		Config::fromFile(__DIR__ . '/does-not-exist.php');
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function valid(): array
	{
		return [
			'env' => 'prod',
			'db' => ['dsn' => 'sqlite::memory:', 'user' => null, 'password' => null],
			'secret' => str_repeat('s', 32),
		];
	}
}
