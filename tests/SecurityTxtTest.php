<?php

declare(strict_types=1);

namespace TimeLion\Tests;

use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

/**
 * public/.well-known/security.txt (RFC 9116) is deployed from the repository. Its Expires date must be renewed by hand,
 * so this test fails 30 days before it passes.
 */
final class SecurityTxtTest extends TestCase
{
	private const string PATH = __DIR__ . '/../public/.well-known/security.txt';

	/** RFC 9116, section 2.5 */
	private const array FIELDS = [
		'acknowledgments', 'canonical', 'contact', 'encryption', 'expires', 'hiring', 'policy', 'preferred-languages',
	];

	private const int RENEW_DAYS_BEFORE = 30;
	private const int MAX_DAYS_AHEAD = 366;

	public function testOnlyHasKnownFields(): void
	{
		foreach (array_keys(self::fields()) as $name) {
			self::assertContains($name, self::FIELDS, sprintf('Unknown field "%s".', $name));
		}
	}

	public function testContactsAreHttpsOrMail(): void
	{
		$contacts = self::fields()['contact'] ?? [];

		self::assertNotEmpty($contacts, 'Contact is required.');
		foreach ($contacts as $contact) {
			self::assertMatchesRegularExpression('#^(https://|mailto:)\S+$#D', $contact);
		}
		foreach (self::fields()['policy'] ?? [] as $policy) {
			self::assertMatchesRegularExpression('#^https://\S+$#D', $policy);
		}
	}

	public function testExpiresIsInTheComingYear(): void
	{
		$values = self::fields()['expires'] ?? [];
		self::assertCount(1, $values, 'Expires is required, once.');

		$expires = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s.v\Z', $values[0], new DateTimeZone('UTC'));
		self::assertNotFalse($expires, 'Expires must look like 2027-01-31T00:00:00.000Z.');

		$daysLeft = ($expires->getTimestamp() - time()) / 86400;
		self::assertGreaterThan(
			self::RENEW_DAYS_BEFORE,
			$daysLeft,
			sprintf('security.txt expires on %s: move Expires up to a year ahead.', $values[0]),
		);
		self::assertLessThanOrEqual(self::MAX_DAYS_AHEAD, $daysLeft, 'Expires should be at most a year ahead.');
	}

	/**
	 * @return array<string, list<string>> values by lowercase field name
	 */
	private static function fields(): array
	{
		$content = file_get_contents(self::PATH);
		self::assertIsString($content);
		self::assertTrue(mb_check_encoding($content, 'UTF-8'));

		$fields = [];
		foreach (preg_split('/\r?\n/', $content) ?: [] as $line) {
			if ($line === '' || str_starts_with($line, '#')) {
				continue;
			}
			self::assertMatchesRegularExpression('/^[A-Za-z-]+: \S/', $line, sprintf('Not a field: "%s".', $line));
			[$name, $value] = explode(': ', $line, 2);
			$fields[strtolower($name)][] = trim($value);
		}

		return $fields;
	}
}
