-- Free extra lives: no purchases. One per player per show, earned by a
-- referral (a signed-in friend joins via your link) or a rewarded ad.

ALTER TABLE show_participants
  ADD COLUMN IF NOT EXISTS referral_code TEXT
    DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES show_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_life_source TEXT
    CHECK (extra_life_source IN ('referral', 'rewarded_ad')),
  ADD COLUMN IF NOT EXISTS extra_life_used_at_question INT;

UPDATE show_participants
SET referral_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
WHERE referral_code IS NULL;

ALTER TABLE show_participants ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS show_participants_show_referral_code
  ON show_participants (show_id, referral_code);

-- Server-verified rewarded-ad views.
CREATE TABLE IF NOT EXISTS ad_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES show_participants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rewarded BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ad_sessions_participant ON ad_sessions(participant_id);

-- One grant per player per show, enforced by the database.
CREATE TABLE IF NOT EXISTS extra_life_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES show_participants(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('referral', 'rewarded_ad')),
  referred_participant_id UUID REFERENCES show_participants(id) ON DELETE SET NULL,
  ad_session_id UUID REFERENCES ad_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (show_id, participant_id)
);

-- Service role only.
ALTER TABLE ad_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_life_grants ENABLE ROW LEVEL SECURITY;
