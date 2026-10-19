<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use TimeLion\Config;
use TimeLion\Tests\AppTestCase;
use TimeLion\Tests\TestDatabase;

final class PrivacyPolicyTest extends AppTestCase
{
	public function testReturnsTheConfiguredText(): void
	{
		$text = "## Verantwortlich\n\nMax Muster\nBeispielweg 1\n3000 Bern";
		$base = TestDatabase::config();
		$this->app->getContainer()->set(
			Config::class,
			new Config($base->env, $base->dbDsn, $base->dbUser, $base->dbPassword, $base->secret, privacyPolicy: $text),
		);

		$response = $this->request('GET', '/api/privacy-policy');

		self::assertSame(200, $response->getStatusCode());
		self::assertSame(['text' => $text], self::json($response));
		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
	}

	public function testIsNotFoundWithoutOne(): void
	{
		self::assertError(404, 'not_found', $this->request('GET', '/api/privacy-policy'));
	}
}
