<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use TimeLion\Http\Middleware\PurgeMiddleware;
use TimeLion\Maintenance\Purger;
use TimeLion\Polls\Poll;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\Fixtures;

final class PurgeMiddlewareTest extends AppTestCase
{
	/** @var list<string> */
	private array $logged = [];

	private Poll $expired;

	protected function setUp(): void
	{
		parent::setUp();
		$this->expired = Fixtures::poll(createdAt: $this->clock->now() - 100, expiresAt: $this->clock->now());
		$this->polls()->insert($this->expired);
		$this->responses()->insert(Fixtures::response($this->expired->id));
	}

	public function testPurgesAfterTheRequestWhenChosen(): void
	{
		$this->purgeOnEveryRequest();

		self::assertSame(200, $this->request('GET', '/api/health')->getStatusCode());

		self::assertNull($this->polls()->findActive($this->expired->id, 0));
		self::assertSame(0, $this->responses()->countForPoll($this->expired->id));
	}

	public function testLeavesDataAloneWhenNotChosen(): void
	{
		$this->request('GET', '/api/health');

		self::assertNotNull($this->polls()->findActive($this->expired->id, 0));
	}

	public function testFailedPurgeIsLoggedAndTheRequestStillSucceeds(): void
	{
		$this->purgeOnEveryRequest();
		$this->pdo->exec('DROP TABLE responses');
		$this->pdo->exec('DROP TABLE polls');

		$response = $this->request('GET', '/api/health');

		self::assertSame(200, $response->getStatusCode());
		self::assertSame(['status' => 'ok'], self::json($response));
		self::assertCount(1, $this->logged);
		self::assertStringStartsWith('[TimeLion] Purge failed: PDOException', $this->logged[0] ?? '');
	}

	public function testRunsWithAboutTwoPercentChanceByDefault(): void
	{
		self::assertSame(50, PurgeMiddleware::ONE_IN);
	}

	private function purgeOnEveryRequest(): void
	{
		$this->app->getContainer()->set(
			PurgeMiddleware::class,
			fn(Purger $purger): PurgeMiddleware => new PurgeMiddleware($purger, static fn(): bool => true, function (string $message): void {
				$this->logged[] = $message;
			}),
		);
	}
}
