<?php

declare(strict_types=1);

namespace TimeLion\Tests\Deploy;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use TimeLion\Deploy\DeployToken;

final class DeployTokenTest extends TestCase
{
	private const string HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

	private string $path;

	protected function setUp(): void
	{
		$this->path = sys_get_temp_dir() . '/timelion-deploy-token-' . bin2hex(random_bytes(4));
	}

	protected function tearDown(): void
	{
		if (is_file($this->path)) {
			unlink($this->path);
		}
	}

	public function testNothingIsPendingWithoutFile(): void
	{
		self::assertNull((new DeployToken($this->path))->pendingHash());
	}

	public function testReadsHashIgnoringTrailingNewline(): void
	{
		file_put_contents($this->path, self::HASH . "\n");

		self::assertSame(self::HASH, (new DeployToken($this->path))->pendingHash());
	}

	public function testRejectsFileWithoutHash(): void
	{
		file_put_contents($this->path, 'not a hash');

		$this->expectException(RuntimeException::class);
		(new DeployToken($this->path))->pendingHash();
	}

	public function testConsumeDeletesFileOnce(): void
	{
		file_put_contents($this->path, self::HASH);
		$token = new DeployToken($this->path);

		$token->consume();

		self::assertNull($token->pendingHash());
		$this->expectException(RuntimeException::class);
		$token->consume();
	}
}
