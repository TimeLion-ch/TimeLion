<?php

declare(strict_types=1);

namespace TimeLion\Tests\Http;

use TimeLion\Tests\AppTestCase;

final class HealthTest extends AppTestCase
{
	public function testHealthReportsOk(): void
	{
		$response = $this->request('GET', '/api/health');

		self::assertSame(200, $response->getStatusCode());
		self::assertSame(['status' => 'ok'], self::json($response));
	}

	public function testApiResponsesCarrySecurityHeaders(): void
	{
		$response = $this->request('GET', '/api/health');

		self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
		self::assertSame("default-src 'none'; frame-ancestors 'none'", $response->getHeaderLine('Content-Security-Policy'));
		self::assertSame('no-referrer', $response->getHeaderLine('Referrer-Policy'));
		self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
	}
}
