<?php

declare(strict_types=1);

namespace TimeLion\Tests\Repository;

use PHPUnit\Framework\TestCase;
use TimeLion\Repository\RateLimitRepository;
use TimeLion\Tests\TestDatabase;

final class RateLimitRepositoryTest extends TestCase
{
	private const string BUCKET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
	private const string OTHER_BUCKET = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
	private const int WINDOW = 1_799_998_400;

	private RateLimitRepository $rateLimits;

	protected function setUp(): void
	{
		$this->rateLimits = new RateLimitRepository(TestDatabase::migrated());
	}

	protected function tearDown(): void
	{
		unset($this->rateLimits);
	}

	public function testCountsHitsPerBucketAndWindow(): void
	{
		self::assertSame(1, $this->rateLimits->hit(self::BUCKET, self::WINDOW));
		self::assertSame(2, $this->rateLimits->hit(self::BUCKET, self::WINDOW));
		self::assertSame(1, $this->rateLimits->hit(self::OTHER_BUCKET, self::WINDOW));
		self::assertSame(3, $this->rateLimits->hit(self::BUCKET, self::WINDOW));
	}

	public function testNewWindowStartsAtOne(): void
	{
		$this->rateLimits->hit(self::BUCKET, self::WINDOW);
		$this->rateLimits->hit(self::BUCKET, self::WINDOW);

		self::assertSame(1, $this->rateLimits->hit(self::BUCKET, self::WINDOW + 3600));
		self::assertSame(2, $this->rateLimits->hit(self::BUCKET, self::WINDOW + 3600));
	}

	public function testDeletesRowsOfEarlierWindows(): void
	{
		$this->rateLimits->hit(self::BUCKET, self::WINDOW - 3600);
		$this->rateLimits->hit(self::OTHER_BUCKET, self::WINDOW);

		self::assertSame(1, $this->rateLimits->deleteBefore(self::WINDOW));
		self::assertSame(0, $this->rateLimits->deleteBefore(self::WINDOW));
		self::assertSame(2, $this->rateLimits->hit(self::OTHER_BUCKET, self::WINDOW));
		self::assertSame(1, $this->rateLimits->hit(self::BUCKET, self::WINDOW));
	}
}
