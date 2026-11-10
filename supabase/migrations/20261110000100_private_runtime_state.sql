-- Stop leaking answers to clients.
--
-- Before: shows.current_state held the full runtime state (every question
-- with its correct_choice_id, plus every participant's guest token) and is
-- readable by anyone via RLS + Realtime. The questions table had no RLS at
-- all, so the anon key could read every answer directly.
--
-- After:
--   * show_runtime (service role only) holds the full runtime state.
--   * shows.current_state holds only the PublicShowState projection
--     (current question, no answer until reveal, no participant identities).
--   * questions / question_sets have RLS with no anon policy for questions.

CREATE TABLE IF NOT EXISTS show_runtime (
  show_id UUID PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on, no policies: only the service role (runner + API routes) can read.
ALTER TABLE show_runtime ENABLE ROW LEVEL SECURITY;

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question sets are readable by everyone"
  ON question_sets FOR SELECT USING (true);
-- (no SELECT policy on questions: answers stay server-side)

-- Carry over any in-flight show state, then scrub the public copy.
INSERT INTO show_runtime (show_id, state)
SELECT id, current_state FROM shows
WHERE current_state ? 'showId'
ON CONFLICT (show_id) DO NOTHING;

UPDATE shows SET current_state = '{}'::jsonb WHERE current_state ? 'questions';

-- Make sure shows changes are broadcast over Realtime.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shows'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shows;
  END IF;
END $$;
