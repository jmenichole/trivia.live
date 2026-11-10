-- Late joiners (after the first question opens) watch as spectators and are
-- not counted as players or eligible for prizes.
ALTER TABLE show_participants
  ADD COLUMN IF NOT EXISTS spectator BOOLEAN NOT NULL DEFAULT false;
