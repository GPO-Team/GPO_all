CREATE SCHEMA IF NOT EXISTS gpo_warehouse;

CREATE TABLE IF NOT EXISTS gpo_warehouse.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL CHECK (revision >= 0),
  schema_version integer NOT NULL CHECK (schema_version = 1)
);

CREATE TABLE IF NOT EXISTS gpo_warehouse.items (
  collection text NOT NULL CHECK (collection IN ('racks', 'stations', 'cargo', 'tasks', 'taskArchive')),
  id varchar(63) NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND body->>'id' IS NOT NULL AND body->>'id' = id),
  PRIMARY KEY (collection, id)
);
