<?php

declare(strict_types=1);

namespace TimeLion\Database;

use PDO;
use RuntimeException;
use TimeLion\Config;

/**
 * Creates the PDO connection. Supported drivers: sqlite (development, small installs) and mysql (MySQL/MariaDB).
 */
final class ConnectionFactory
{
	public static function create(Config $config): PDO
	{
		$pdo = new PDO($config->dbDsn, $config->dbUser, $config->dbPassword, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		]);

		switch ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)) {
			case 'sqlite':
				$pdo->exec('PRAGMA foreign_keys = ON');
				$pdo->exec('PRAGMA busy_timeout = 5000');
				break;
			case 'mysql':
				$pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
				$pdo->exec("SET NAMES utf8mb4, time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
				break;
			default:
				throw new RuntimeException('Unsupported database driver. Use sqlite or mysql.');
		}

		return $pdo;
	}
}
