CREATE TABLE IF NOT EXISTS responses (
  id            SERIAL PRIMARY KEY,
  response_id   TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  sections      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
