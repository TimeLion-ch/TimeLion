<?php

declare(strict_types=1);

namespace TimeLion\Tests\Security;

use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use TimeLion\Config;
use TimeLion\Http\ApiError;
use TimeLion\Repository\RateLimitRepository;
use TimeLion\Security\RateLimit;
use TimeLion\Security\RateLimiter;
use TimeLion\Tests\FrozenClock;
use TimeLion\Tests\TestDatabase;

final class RateLimiterTest extends TestCase
{
	/** 2027-01-15 08:00:00 UTC, the start of a window. */
	private const int WINDOW_START = 1_800_000_000 - 1_800_000_000 % 3600;

	private PDO $pdo;
	private FrozenClock $clock;
	private RateLimiter $limiter;

	protected function setUp(): void
	{
		$this->pdo = TestDatabase::migrated();
		$this->clock = new FrozenClock(self::WINDOW_START);
		$this->limiter = new RateLimiter(new RateLimitRepository($this->pdo), $this->clock, TestDatabase::config());
	}

	protected function tearDown(): void
	{
		unset($this->pdo, $this->limiter);
	}

	public function testLimitsAreTunableConstants(): void
	{
		self::assertSame(20, RateLimit::CreatePoll->perWindow());
		self::assertSame(60, RateLimit::WriteResponse->perWindow());
		self::assertSame(120, RateLimit::AdminWrite->perWindow());
		self::assertSame(3600, RateLimit::WINDOW);
	}

	public function testRejectsRequestsOverTheLimitWithRetryAfter(): void
	{
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
		$this->clock->advance(600);

		$error = $this->rejected(RateLimit::CreatePoll, '192.0.2.1');

		self::assertSame(429, $error->status);
		self::assertSame('too_many_requests', $error->errorCode);
		self::assertSame(['Retry-After' => '3000'], $error->headers, 'seconds until the next window');
	}

	public function testRejectedRequestsKeepBeingRejected(): void
	{
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
		$this->rejected(RateLimit::CreatePoll, '192.0.2.1');

		$this->clock->advance(3599);
		self::assertSame(['Retry-After' => '1'], $this->rejected(RateLimit::CreatePoll, '192.0.2.1')->headers);
	}

	public function testNextWindowStartsAfresh(): void
	{
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
		$this->clock->advance(3600);

		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
		$this->rejected(RateLimit::CreatePoll, '192.0.2.1');
	}

	public function testWindowsAreFixedNotSliding(): void
	{
		$this->clock->advance(3599);
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');

		$this->clock->advance(1);
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
	}

	public function testIpsAreLimitedIndependently(): void
	{
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');
		$this->rejected(RateLimit::CreatePoll, '192.0.2.1');

		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.2');
		$this->hitTimes(20, RateLimit::CreatePoll, '2001:db8::1');
	}

	public function testActionsAreLimitedIndependently(): void
	{
		$this->hitTimes(20, RateLimit::CreatePoll, '192.0.2.1');

		$this->hitTimes(60, RateLimit::WriteResponse, '192.0.2.1');
		$this->rejected(RateLimit::WriteResponse, '192.0.2.1');
		$this->hitTimes(120, RateLimit::AdminWrite, '192.0.2.1');
		$this->rejected(RateLimit::AdminWrite, '192.0.2.1');
	}

	public function testBucketIsTheSpecifiedHmac(): void
	{
		$dailyKey = hash_hmac('sha256', 'rate-limit|2027-01-15', str_repeat('s', Config::MIN_SECRET_LENGTH), true);

		self::assertSame(
			hash_hmac('sha256', 'create_poll|192.0.2.1', $dailyKey),
			$this->limiter->bucket(RateLimit::CreatePoll, '192.0.2.1', self::WINDOW_START),
		);
	}

	public function testBucketChangesWithTheUtcDayAndTheSecret(): void
	{
		$midnight = 1_800_057_600; // 2027-01-16 00:00:00 UTC
		$bucket = $this->limiter->bucket(RateLimit::CreatePoll, '192.0.2.1', $midnight - 1);
		$otherSecret = new RateLimiter(new RateLimitRepository($this->pdo), $this->clock, new Config('prod', 'sqlite::memory:', null, null, str_repeat('t', 32)));

		self::assertSame($bucket, $this->limiter->bucket(RateLimit::CreatePoll, '192.0.2.1', $midnight - 86400));
		self::assertNotSame($bucket, $this->limiter->bucket(RateLimit::CreatePoll, '192.0.2.1', $midnight));
		self::assertNotSame($bucket, $otherSecret->bucket(RateLimit::CreatePoll, '192.0.2.1', $midnight - 1));
	}

	public function testTableNeverContainsAnIp(): void
	{
		$ips = ['192.0.2.1', '198.51.100.23', '2001:db8::1', '::ffff:192.0.2.99'];
		foreach ($ips as $ip) {
			foreach (RateLimit::cases() as $limit) {
				$this->limiter->hit($limit, self::request($ip));
			}
		}

		$statement = $this->pdo->query('SELECT bucket, window_start, hits FROM rate_limits');
		self::assertNotFalse($statement);
		$rows = $statement->fetchAll(PDO::FETCH_ASSOC);
		self::assertCount(count($ips) * count(RateLimit::cases()), $rows);
		$dump = json_encode($rows, JSON_THROW_ON_ERROR);
		foreach ($ips as $ip) {
			self::assertStringNotContainsString($ip, $dump);
			self::assertStringNotContainsString(bin2hex((string) inet_pton($ip)), $dump);
		}
		foreach ($rows as $row) {
			self::assertIsArray($row);
			self::assertIsString($row['bucket'] ?? null);
			self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/D', $row['bucket']);
		}
	}

	public function testUsesTheTrustedProxyHeaderWhenConfigured(): void
	{
		$config = new Config('prod', 'sqlite::memory:', null, null, str_repeat('s', 32), 'X-Forwarded-For');
		$limiter = new RateLimiter(new RateLimitRepository($this->pdo), $this->clock, $config);
		$viaProxy = static fn(string $client): ServerRequestInterface => self::request('10.0.0.1')->withHeader('X-Forwarded-For', $client);

		for ($i = 0; $i < 20; $i++) {
			$limiter->hit(RateLimit::CreatePoll, $viaProxy('192.0.2.1'));
		}

		$limiter->hit(RateLimit::CreatePoll, $viaProxy('192.0.2.2'));
		$this->expectException(ApiError::class);
		$limiter->hit(RateLimit::CreatePoll, $viaProxy('192.0.2.1'));
	}

	/**
	 * Asserts that the next $times requests are accepted.
	 */
	private function hitTimes(int $times, RateLimit $limit, string $ip): void
	{
		for ($i = 1; $i <= $times; $i++) {
			try {
				$this->limiter->hit($limit, self::request($ip));
			} catch (ApiError) {
				self::fail(sprintf('Request %d of %d was rate limited', $i, $times));
			}
			$this->addToAssertionCount(1);
		}
	}

	private function rejected(RateLimit $limit, string $ip): ApiError
	{
		try {
			$this->limiter->hit($limit, self::request($ip));
		} catch (ApiError $error) {
			return $error;
		}

		self::fail('Expected the request to be rate limited');
	}

	private static function request(string $ip): ServerRequestInterface
	{
		return (new ServerRequestFactory())->createServerRequest('POST', '/api/polls', ['REMOTE_ADDR' => $ip]);
	}
}
