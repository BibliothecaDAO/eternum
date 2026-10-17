-- Every operator action the page sends, with the Access identity that sent it: written before the call, completed after.
CREATE TABLE actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  email TEXT NOT NULL,
  environment TEXT NOT NULL,
  action TEXT NOT NULL,
  request TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('sent', 'done', 'failed')),
  status INTEGER,
  response TEXT
);
CREATE INDEX actions_by_time ON actions (at DESC);
