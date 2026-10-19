-- Polls and their responses. Content is ciphertext only (see CLAUDE.md → Encryption design); timestamps are Unix seconds.
CREATE TABLE polls (
	id CHAR(32) NOT NULL PRIMARY KEY,
	admin_token_hash CHAR(64) NOT NULL,
	ciphertext MEDIUMTEXT NOT NULL,
	created_at BIGINT NOT NULL,
	updated_at BIGINT NOT NULL,
	expires_at BIGINT NOT NULL,
	closed_at BIGINT DEFAULT NULL
);

CREATE INDEX polls_expires_at ON polls (expires_at);

CREATE TABLE responses (
	id CHAR(32) NOT NULL PRIMARY KEY,
	poll_id CHAR(32) NOT NULL,
	edit_token_hash CHAR(64) NOT NULL,
	ciphertext TEXT NOT NULL,
	created_at BIGINT NOT NULL,
	updated_at BIGINT NOT NULL,
	CONSTRAINT responses_poll_id_fk FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE
);

CREATE INDEX responses_poll_id ON responses (poll_id);
