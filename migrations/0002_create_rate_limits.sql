-- Fixed-window request counters. bucket is an HMAC of the action and the client IP under a key that changes every
-- UTC day (src/Security/RateLimiter.php), so this table never holds an IP address.
CREATE TABLE rate_limits (
	bucket CHAR(64) NOT NULL PRIMARY KEY,
	window_start BIGINT NOT NULL,
	hits INTEGER NOT NULL
);
