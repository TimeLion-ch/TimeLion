<?php

declare(strict_types=1);

namespace TimeLion\Tests\Maintenance;

use PHPUnit\Framework\TestCase;
use TimeLion\Config;
use TimeLion\Database\ConnectionFactory;
use TimeLion\Database\Migrator;
use TimeLion\Repository\PollRepository;
use TimeLion\Tests\Fixtures;

/**
 * Runs bin/purge.php as cron would, against a temporary SQLite file.
 */
final class PurgeScriptTest extends TestCase
{
	private string $directory;

	protected function setUp(): void
	{
		$this->directory = sys_get_temp_dir() . '/timelion-purge-' . bin2hex(random_bytes(4));
		mkdir($this->directory);
	}

	protected function tearDown(): void
	{
		foreach (glob($this->directory . '/*') ?: [] as $file) {
			unlink($file);
		}
		rmdir($this->directory);
	}

	public function testDeletesExpiredPolls(): void
	{
		$database = $this->directory . '/test.sqlite';
		$configFile = $this->directory . '/config.php';
		file_put_contents($configFile, sprintf(
			"<?php return ['env' => 'prod', 'db' => ['dsn' => %s, 'user' => null, 'password' => null], 'secret' => %s];\n",
			var_export('sqlite:' . $database, true),
			var_export(str_repeat('s', 32), true),
		));
		$pdo = ConnectionFactory::create(Config::fromFile($configFile));
		(new Migrator($pdo, dirname(__DIR__, 2) . '/migrations'))->migrate();
		$polls = new PollRepository($pdo);
		$expired = Fixtures::poll(createdAt: time() - 100, expiresAt: time() - 1);
		$active = Fixtures::poll(createdAt: time(), expiresAt: time() + 3600);
		$polls->insert($expired);
		$polls->insert($active);

		[$exitCode, $output] = $this->runPurgeScript($configFile);

		self::assertSame(0, $exitCode, $output);
		self::assertSame("Deleted 1 expired poll(s) and 0 stale rate-limit row(s).\n", $output);
		self::assertNull($polls->findActive($expired->id, 0));
		self::assertNotNull($polls->findActive($active->id, time()));
	}

	public function testFailsWithoutConfiguration(): void
	{
		[$exitCode] = $this->runPurgeScript($this->directory . '/missing.php');

		self::assertSame(1, $exitCode);
	}

	/**
	 * @return array{int, string} exit code and standard output
	 */
	private function runPurgeScript(string $configFile): array
	{
		$process = proc_open(
			[PHP_BINARY, dirname(__DIR__, 2) . '/bin/purge.php'],
			[1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
			$pipes,
			null,
			['TIMELION_CONFIG' => $configFile] + getenv(),
		);
		self::assertIsResource($process);
		$output = stream_get_contents($pipes[1]);
		stream_get_contents($pipes[2]);
		fclose($pipes[1]);
		fclose($pipes[2]);

		return [proc_close($process), (string) $output];
	}
}
