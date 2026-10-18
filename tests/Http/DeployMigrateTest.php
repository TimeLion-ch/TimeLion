<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use PDO;
use Psr\Http\Message\ResponseInterface;
use TimeLion\Database\Migrator;
use TimeLion\Deploy\DeployToken;
use TimeLion\Security\TokenHash;
use TimeLion\Tests\AppTestCase;

final class DeployMigrateTest extends AppTestCase
{
	private const string TOKEN = '78Fy1spBVJ1gUmMwbMZ8BTXz_N-rycKaoJ6QrIscv8Q';
	private const string OTHER_TOKEN = 'qF6gHKgVCt6phJkY7FpOjImUkMqH4_BOQwLSDiY2JJY';
	private const string FIXTURES = __DIR__ . '/../fixtures/migrations';

	private string $tokenFile;

	protected function setUp(): void
	{
		parent::setUp();
		$this->tokenFile = sys_get_temp_dir() . '/timelion-deploy-token-' . bin2hex(random_bytes(4));
		$this->app->getContainer()->set(DeployToken::class, new DeployToken($this->tokenFile));
		$this->useMigrations(self::FIXTURES);
	}

	protected function tearDown(): void
	{
		if (is_file($this->tokenFile)) {
			unlink($this->tokenFile);
		}
	}

	public function testIsNotFoundWhileNoDeployIsPending(): void
	{
		self::assertSame(404, $this->migrate(self::TOKEN)->getStatusCode());
		self::assertSame(404, $this->migrate(null)->getStatusCode(), 'the endpoint must not reveal itself by asking for a token');
	}

	public function testRejectsMissingTokenWith401(): void
	{
		$this->startDeploy();

		$response = $this->migrate(null);

		self::assertSame(401, $response->getStatusCode());
		self::assertFileExists($this->tokenFile, 'a rejected request must not consume the token');
	}

	public function testRejectsWrongTokenWith403(): void
	{
		$this->startDeploy();

		$response = $this->migrate(self::OTHER_TOKEN);

		self::assertSame(403, $response->getStatusCode());
		self::assertFileExists($this->tokenFile, 'a rejected request must not consume the token');
	}

	public function testAppliesPendingMigrationsAndConsumesTheToken(): void
	{
		$this->startDeploy();

		$response = $this->migrate(self::TOKEN);

		self::assertSame(200, $response->getStatusCode());
		self::assertSame(['applied' => ['0001_create_things', '0002_add_thing_tags']], self::json($response));
		self::assertFileDoesNotExist($this->tokenFile);
		self::assertSame(404, $this->migrate(self::TOKEN)->getStatusCode(), 'the token works only once');
	}

	public function testReportsNothingAppliedWhenUpToDate(): void
	{
		$this->startDeploy();
		$this->migrate(self::TOKEN);
		$this->startDeploy();

		self::assertSame(['applied' => []], self::json($this->migrate(self::TOKEN)));
	}

	public function testReportsWhichMigrationFailed(): void
	{
		$this->expectErrorLog();
		$directory = sys_get_temp_dir() . '/timelion-migrations-' . bin2hex(random_bytes(4));
		mkdir($directory);
		file_put_contents($directory . '/0001_broken.sql', "THIS IS NOT SQL;\n");
		$this->useMigrations($directory);
		$this->startDeploy();

		try {
			$response = $this->migrate(self::TOKEN);
		} finally {
			unlink($directory . '/0001_broken.sql');
			rmdir($directory);
		}

		self::assertSame(500, $response->getStatusCode());
		$error = self::json($response)['error'] ?? null;
		self::assertIsArray($error);
		self::assertSame('migration_failed', $error['code'] ?? null);
		self::assertIsString($error['message'] ?? null);
		self::assertStringContainsString('0001_broken', $error['message']);
		self::assertFileDoesNotExist($this->tokenFile, 'the token is consumed even if a migration fails');
	}

	private function startDeploy(): void
	{
		file_put_contents($this->tokenFile, TokenHash::hash(self::TOKEN) . "\n");
	}

	private function useMigrations(string $directory): void
	{
		$this->app->getContainer()->set(
			Migrator::class,
			static fn(PDO $pdo): Migrator => new Migrator($pdo, $directory),
		);
	}

	private function migrate(?string $token): ResponseInterface
	{
		return $this->request('POST', '/api/deploy/migrate', null, $token === null ? [] : ['Authorization' => 'Bearer ' . $token]);
	}
}
