-- DripFinder usage events (D1). Anonymous and first-party.
-- No IP address and nothing that identifies a person is ever stored here.
CREATE TABLE IF NOT EXISTS events (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL,          -- client slug, e.g. "dripit"
  event TEXT NOT NULL,          -- view | start | result | stop_emergency | stop_talk | book_click | text_click
  item  TEXT,                   -- matched item id (for result / book_click), else ''
  src   TEXT,                   -- traffic source from ?src=, else ''
  path  TEXT,                   -- page path only (no query string)
  day   TEXT NOT NULL,          -- YYYY-MM-DD (visitor's date)
  ts    INTEGER NOT NULL        -- server receive time, epoch ms
);
CREATE INDEX IF NOT EXISTS idx_events_slug_day   ON events (slug, day);
CREATE INDEX IF NOT EXISTS idx_events_slug_event ON events (slug, event);
