<?php

declare(strict_types=1);

namespace TimeLion\Http;

use Psr\Http\Message\ServerRequestInterface;

/**
 * The client's IP address, used only to derive rate-limit buckets and never stored.
 */
final class ClientIp
{
	/**
	 * @param string|null $trustedProxyHeader the header a reverse proxy puts the client IP in (config
	 *                                        `trusted_proxy_header`); for a list such as X-Forwarded-For, the last
	 *                                        entry counts, because that is the one the proxy added
	 */
	public static function fromRequest(ServerRequestInterface $request, ?string $trustedProxyHeader): string
	{
		if ($trustedProxyHeader !== null) {
			$entries = explode(',', $request->getHeaderLine($trustedProxyHeader));
			$candidate = trim($entries[array_key_last($entries)]);
			if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
				return $candidate;
			}
		}

		$remoteAddress = $request->getServerParams()['REMOTE_ADDR'] ?? null;

		return is_string($remoteAddress) ? $remoteAddress : '';
	}
}
