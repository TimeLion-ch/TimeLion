CREATE TABLE thing_tags (
	thing_id VARCHAR(32) NOT NULL REFERENCES things (id) ON DELETE CASCADE,
	tag VARCHAR(50) NOT NULL
);

CREATE INDEX thing_tags_thing_id ON thing_tags (thing_id);
