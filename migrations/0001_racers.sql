CREATE TABLE IF NOT EXISTS racers (
  name_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 120000),
  achieved_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS racers_rank ON racers(score DESC, achieved_at ASC, name_key ASC);
