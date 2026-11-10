-- Server-recorded answer timing for the real speed bonus and the
-- tie-break (fastest cumulative answer time).
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS answer_ms INT,      -- ms from question open to answer (server clock)
  ADD COLUMN IF NOT EXISTS ms_remaining INT;   -- ms left on the 10s clock (0 in grace period)

ALTER TABLE show_participants
  ADD COLUMN IF NOT EXISTS total_answer_ms INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN show_participants.eliminated_at_question IS
  '1-based question number the player was knocked out on; NULL = still in';
