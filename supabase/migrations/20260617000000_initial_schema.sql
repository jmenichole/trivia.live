-- enums
CREATE TYPE show_status AS ENUM (
  'scheduled', 'lobby', 'live', 'completed', 'cancelled'
);

CREATE TYPE show_phase AS ENUM (
  'scheduled', 'lobby', 'question', 'reveal', 'results', 'completed', 'cancelled'
);

-- question sets
CREATE TABLE question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  order_index INT NOT NULL CHECK (order_index BETWEEN 1 AND 12),
  body TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_choice_id TEXT NOT NULL,
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  category TEXT NOT NULL DEFAULT 'general',
  UNIQUE (question_set_id, order_index)
);

CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status show_status NOT NULL DEFAULT 'scheduled',
  current_phase show_phase NOT NULL DEFAULT 'scheduled',
  current_state JSONB NOT NULL DEFAULT '{}',
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  theme TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  discord_id TEXT UNIQUE,
  tiltcheck_linked_at TIMESTAMPTZ,
  total_points INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE show_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  guest_token TEXT,
  eliminated_at_question INT,
  extra_life_available BOOLEAN NOT NULL DEFAULT false,
  extra_life_used BOOLEAN NOT NULL DEFAULT false,
  points_earned INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player_id IS NOT NULL OR guest_token IS NOT NULL),
  UNIQUE (show_id, player_id),
  UNIQUE (show_id, guest_token)
);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES show_participants(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  choice_id TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correct BOOLEAN NOT NULL,
  UNIQUE (show_id, participant_id, question_index)
);

CREATE INDEX idx_shows_scheduled_at ON shows(scheduled_at);
CREATE INDEX idx_show_participants_show ON show_participants(show_id);
CREATE INDEX idx_answers_show ON answers(show_id);

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shows are readable by everyone"
  ON shows FOR SELECT USING (true);

CREATE POLICY "players read own row"
  ON players FOR SELECT USING (auth.uid() = id);

CREATE POLICY "players update own row"
  ON players FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "participants read own"
  ON show_participants FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "answers read own after reveal"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.id = answers.participant_id
        AND sp.player_id = auth.uid()
    )
  );
