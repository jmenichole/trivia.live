ALTER TABLE shows
  ADD COLUMN host_mode TEXT NOT NULL DEFAULT 'off'
    CHECK (host_mode IN ('off', 'live_audio')),
  ADD COLUMN livekit_room TEXT;

COMMENT ON COLUMN shows.host_mode IS 'off = M1 silent; live_audio = LiveKit host';
COMMENT ON COLUMN shows.livekit_room IS 'LiveKit room name; defaults to trivia-{id} when hosted';
