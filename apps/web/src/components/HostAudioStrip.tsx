"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

const AUDIO_KEY = (showId: string) => `host-audio-enabled:${showId}`;

export function HostAudioStrip({
  showId,
  participantId,
}: {
  showId: string;
  participantId: string;
}) {
  const roomRef = useRef<Room | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enableAudio() {
    setError(null);
    const res = await fetch(
      `/api/livekit/token?showId=${showId}&role=player&participantId=${participantId}`,
    );
    if (!res.ok) {
      setError("Host audio unavailable");
      return;
    }
    const { token, url } = await res.json();
    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === "audio") {
        const el = track.attach();
        document.body.appendChild(el);
      }
    });
    await room.connect(url, token);
    roomRef.current = room;
    setEnabled(true);
    setConnected(true);
    sessionStorage.setItem(AUDIO_KEY(showId), "1");
  }

  useEffect(() => {
    if (sessionStorage.getItem(AUDIO_KEY(showId)) === "1") {
      enableAudio();
    }
    return () => {
      roomRef.current?.disconnect();
    };
  }, [showId, participantId]);

  if (enabled && connected) {
    return <div className="host-audio-strip">🔊 Host audio on</div>;
  }

  return (
    <div className="host-audio-strip">
      <button type="button" className="btn btn-ghost" onClick={enableAudio}>
        Tap to hear the host
      </button>
      {error && <span className="host-audio-error">{error}</span>}
    </div>
  );
}
