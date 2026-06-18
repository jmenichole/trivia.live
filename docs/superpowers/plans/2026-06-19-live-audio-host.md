# Live Audio Host (LiveKit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship H1 live audio hosting — manual admin toggle per show, Host Console mic publish, player audio subscribe via LiveKit, without changing show-runner timing.

**Architecture:** Add `host_mode` to `shows`. New `GET /api/livekit/token` mints JWTs with `livekit-server-sdk`. Host Console at `/host/show/[id]` publishes mic; player show page renders `HostAudioStrip` when `host_mode === live_audio`. Show runner unchanged.

**Tech Stack:** LiveKit Cloud, `livekit-client`, `livekit-server-sdk`, existing Next.js 15 + Supabase Realtime

**Spec:** [`docs/superpowers/specs/2026-06-19-live-audio-host-design.md`](../specs/2026-06-19-live-audio-host-design.md)

---

## Target file structure

```
trivia.live/
├── supabase/migrations/
│   └── 20260619100000_add_host_mode.sql
├── apps/web/
│   ├── package.json                          # + livekit-client, livekit-server-sdk
│   ├── src/lib/
│   │   ├── hosts.ts                          # isHostUser(), roomName()
│   │   └── livekit/
│   │       └── mintToken.ts                  # server-only token helper
│   ├── src/app/api/livekit/token/route.ts
│   ├── src/app/host/
│   │   ├── layout.tsx                        # host auth gate
│   │   └── show/[id]/page.tsx                # Host Console
│   ├── src/components/
│   │   ├── HostAudioStrip.tsx                # player subscribe UI
│   │   └── HostConsole.tsx                   # host publish UI
│   └── src/app/admin/CreateShowForm.tsx      # + live audio toggle
├── apps/web/src/app/show/[id]/page.tsx       # + HostAudioStrip
├── apps/web/src/app/page.tsx                 # + hosted badge (H2-lite)
├── apps/web/src/__tests__/mintToken.test.ts
└── .env.example                              # + LIVEKIT_*, HOST_USER_IDS
```

---

## Phase H1 — Live audio host

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260619100000_add_host_mode.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE shows
  ADD COLUMN host_mode TEXT NOT NULL DEFAULT 'off'
    CHECK (host_mode IN ('off', 'live_audio')),
  ADD COLUMN livekit_room TEXT;

COMMENT ON COLUMN shows.host_mode IS 'off = M1 silent; live_audio = LiveKit host';
COMMENT ON COLUMN shows.livekit_room IS 'LiveKit room name; defaults to trivia-{id} when hosted';
```

- [ ] **Step 2: Apply migration** (Supabase SQL editor or `npx supabase db push`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619100000_add_host_mode.sql
git commit -m "feat(db): add host_mode and livekit_room to shows"
```

---

### Task 2: Host allowlist helper

**Files:**
- Create: `apps/web/src/lib/hosts.ts`

- [ ] **Step 1: Implement helpers**

```typescript
export type HostMode = "off" | "live_audio";

export function isHostUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = [
    ...(process.env.HOST_USER_IDS ?? "").split(","),
    ...(process.env.ADMIN_USER_IDS ?? "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export function roomNameForShow(showId: string): string {
  return `trivia-${showId}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/hosts.ts
git commit -m "feat(web): add host allowlist helpers"
```

---

### Task 3: LiveKit token minting (TDD)

**Files:**
- Create: `apps/web/src/lib/livekit/mintToken.ts`
- Create: `apps/web/src/__tests__/mintToken.test.ts`
- Modify: `apps/web/package.json` — add `livekit-server-sdk`, `vitest` devDep if missing

- [ ] **Step 1: Add dependencies**

```bash
npm install livekit-server-sdk -w @trivia-live/web
npm install -D vitest -w @trivia-live/web
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`

- [ ] **Step 2: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockReturnValue("mock-jwt"),
  })),
}));

import { mintLiveKitToken } from "../lib/livekit/mintToken";

describe("mintLiveKitToken", () => {
  beforeEach(() => {
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
    process.env.LIVEKIT_URL = "wss://test.livekit.cloud";
  });

  it("returns token and url for player subscribe-only", async () => {
    const result = await mintLiveKitToken({
      room: "trivia-abc",
      identity: "player:part-1",
      role: "player",
    });
    expect(result.token).toBe("mock-jwt");
    expect(result.url).toBe("wss://test.livekit.cloud");
  });

  it("throws when LiveKit env missing", async () => {
    delete process.env.LIVEKIT_API_KEY;
    await expect(
      mintLiveKitToken({ room: "r", identity: "i", role: "player" }),
    ).rejects.toThrow("LiveKit not configured");
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `npm run test -w @trivia-live/web`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `mintToken.ts`**

```typescript
import { AccessToken } from "livekit-server-sdk";

export type LiveKitRole = "host" | "player";

export async function mintLiveKitToken(opts: {
  room: string;
  identity: string;
  role: LiveKitRole;
}): Promise<{ token: string; url: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit not configured");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    ttl: 60 * 60 * 2, // 2 hours
  });

  if (opts.role === "host") {
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canSubscribe: true,
    });
  } else {
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: false,
      canSubscribe: true,
    });
  }

  return { token: await at.toJwt(), url };
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm run test -w @trivia-live/web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/livekit/ apps/web/src/__tests__/ apps/web/package.json package-lock.json
git commit -m "feat(web): add LiveKit token minting with tests"
```

---

### Task 4: Token API route

**Files:**
- Create: `apps/web/src/app/api/livekit/token/route.ts`

- [ ] **Step 1: Implement GET handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { isHostUser, roomNameForShow } from "@/lib/hosts";
import { mintLiveKitToken } from "@/lib/livekit/mintToken";

export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  const role = req.nextUrl.searchParams.get("role");
  const participantId = req.nextUrl.searchParams.get("participantId");

  if (!showId || (role !== "host" && role !== "player")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("id, host_mode, livekit_room")
    .eq("id", showId)
    .single();

  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  if (show.host_mode !== "live_audio") {
    return NextResponse.json({ error: "Show not hosted" }, { status: 400 });
  }

  const room = show.livekit_room ?? roomNameForShow(showId);

  if (role === "host") {
    const supabase = await createClient();
    const { data: { user } } = await supabase!.auth.getUser();
    if (!isHostUser(user?.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const { token, url } = await mintLiveKitToken({
        room,
        identity: `host:${user!.id}`,
        role: "host",
      });
      return NextResponse.json({ token, url });
    } catch {
      return NextResponse.json({ error: "LiveKit unavailable" }, { status: 503 });
    }
  }

  // player
  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }
  const { data: participant } = await admin
    .from("show_participants")
    .select("id")
    .eq("id", participantId)
    .eq("show_id", showId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Invalid participant" }, { status: 403 });
  }

  try {
    const { token, url } = await mintLiveKitToken({
      room,
      identity: `player:${participantId}`,
      role: "player",
    });
    return NextResponse.json({ token, url });
  } catch {
    return NextResponse.json({ error: "LiveKit unavailable" }, { status: 503 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w @trivia-live/web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/livekit/
git commit -m "feat(api): add LiveKit token endpoint"
```

---

### Task 5: Admin toggle for hosted shows

**Files:**
- Modify: `apps/web/src/app/admin/CreateShowForm.tsx`
- Modify: `apps/web/src/app/api/admin/shows/route.ts`
- Modify: `apps/web/src/app/admin/page.tsx` — show host_mode in list + link to Host Console

- [ ] **Step 1: Add checkbox to CreateShowForm**

```tsx
<label className="admin-label admin-checkbox">
  <input type="checkbox" name="live_audio_host" />
  Live audio host (I'll read questions on mic)
</label>
```

In `handleSubmit`, read checkbox and send `host_mode: "live_audio" | "off"`.

- [ ] **Step 2: Update POST `/api/admin/shows`**

```typescript
const host_mode = body.host_mode === "live_audio" ? "live_audio" : "off";
const livekit_room = host_mode === "live_audio" ? `trivia-${/* set after insert */}` : null;

// insert with host_mode; after insert, if live_audio, update livekit_room:
// livekit_room: `trivia-${data.id}`
```

Or compute room in one insert using a generated uuid client-side, or update in same request after `.insert().select().single()`.

- [ ] **Step 3: Show host badge + Host Console link on admin list**

```tsx
{show.host_mode === "live_audio" && (
  <span className="admin-host-badge">Live host</span>
)}
<Link href={`/host/show/${show.id}`}>Host console</Link>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/app/api/admin/
git commit -m "feat(admin): add live audio host toggle per show"
```

---

### Task 6: Host Console

**Files:**
- Create: `apps/web/src/app/host/layout.tsx`
- Create: `apps/web/src/app/host/show/[id]/page.tsx`
- Create: `apps/web/src/components/HostConsole.tsx`
- Modify: `apps/web/package.json` — add `livekit-client`

- [ ] **Step 1: Install client SDK**

```bash
npm install livekit-client -w @trivia-live/web
```

- [ ] **Step 2: Host layout (mirror admin gate using `isHostUser`)**

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isHostUser } from "@/lib/hosts";

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase!.auth.getUser();
  if (!isHostUser(user?.id)) redirect("/");
  return <div className="host-layout">{children}</div>;
}
```

- [ ] **Step 3: Implement `HostConsole.tsx`**

Key behavior:
- `useShowChannel(showId)` for phase + question script
- On "Go live" button click:
  1. `fetch(/api/livekit/token?showId=&role=host)`
  2. `new Room()`, `room.connect(url, token)`
  3. `room.localParticipant.setMicrophoneEnabled(true)`
- Show: phase badge, question body + choices when `phase === 'question'`, connection status, mic enabled indicator
- On unmount: `room.disconnect()`

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";
import type { ShowRuntimeState } from "@trivia-live/game-engine";

export function HostConsole({
  showId,
  state,
}: {
  showId: string;
  state: ShowRuntimeState | null;
}) {
  const roomRef = useRef<Room | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goLive() {
    setError(null);
    const res = await fetch(
      `/api/livekit/token?showId=${showId}&role=host`,
    );
    if (!res.ok) {
      setError("Could not connect to LiveKit");
      return;
    }
    const { token, url } = await res.json();
    const room = new Room();
    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    roomRef.current = room;
    setLive(true);
  }

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  const q =
    state && state.questionIndex >= 0
      ? state.questions[state.questionIndex]
      : null;

  return (
    <div className="host-console">
      <h1>Host Console</h1>
      <p className="host-phase">Phase: {state?.phase ?? "loading…"}</p>
      {!live ? (
        <button className="btn" onClick={goLive}>
          Go live (enable mic)
        </button>
      ) : (
        <span className="host-live-badge">● LIVE</span>
      )}
      {error && <p className="host-error">{error}</p>}
      {q && (
        <div className="host-script">
          <h2>Read aloud:</h2>
          <p>{q.body}</p>
          <ul>
            {q.choices.map((c) => (
              <li key={c.id}>{c.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Host page wires channel + console**

```typescript
"use client";
import { use } from "react";
import { useShowChannel } from "@/hooks/useShowChannel";
import { HostConsole } from "@/components/HostConsole";

export default function HostShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useShowChannel(id);
  return <HostConsole showId={id} state={state} />;
}
```

- [ ] **Step 5: Add host console CSS to `globals.css`**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/host/ apps/web/src/components/HostConsole.tsx apps/web/src/app/globals.css
git commit -m "feat(web): add Host Console with LiveKit mic publish"
```

---

### Task 7: Player audio strip

**Files:**
- Create: `apps/web/src/components/HostAudioStrip.tsx`
- Modify: `apps/web/src/hooks/useShowChannel.ts` — also return `hostMode` from show row
- Modify: `apps/web/src/app/show/[id]/page.tsx`

- [ ] **Step 1: Extend `useShowChannel` to fetch `host_mode`**

On initial fetch and Realtime UPDATE, read `host_mode` from shows row alongside `current_state`.

```typescript
const [hostMode, setHostMode] = useState<"off" | "live_audio">("off");
// in fetch + postgres_changes handler:
setHostMode(row.host_mode ?? "off");
return { state, hostMode, error, playerCount };
```

- [ ] **Step 2: Implement `HostAudioStrip.tsx`**

```typescript
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
```

- [ ] **Step 3: Render on show page when `hostMode === 'live_audio'`**

```tsx
{hostMode === "live_audio" && session?.participantId && (
  <HostAudioStrip showId={showId} participantId={session.participantId} />
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/HostAudioStrip.tsx apps/web/src/hooks/useShowChannel.ts apps/web/src/app/show/
git commit -m "feat(web): add player LiveKit audio subscribe strip"
```

---

### Task 8: Env, README, and manual verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

```bash
# LiveKit (hosted shows only)
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=wss://your-project.livekit.cloud

# Host console access (comma-separated UUIDs; admins are always hosts)
HOST_USER_IDS=
```

- [ ] **Step 2: Add README section "Live audio hosting"**

Steps:
1. Create LiveKit Cloud project at https://cloud.livekit.io
2. Add env vars to Vercel + local `.env`
3. Schedule show with **Live audio host** checked
4. Open `/host/show/{id}` before show, click **Go live**
5. Players tap **Tap to hear the host** on show page

- [ ] **Step 3: Manual test checklist**

1. Create hosted show in `/admin`
2. Browser A: `/host/show/{id}` → Go live → mic permission granted
3. Browser B: `/show/{id}` → join → Tap to hear host → verify audio element attached
4. Unhosted show: no audio strip, no LiveKit requests in network tab
5. `npm run test -w @trivia-live/web` && `npm run build -w @trivia-live/web`

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add LiveKit setup and live host runbook"
```

---

## Spec coverage checklist (self-review)

| Spec section | Task |
|--------------|------|
| §6 data model | Task 1 |
| §7 token API | Tasks 3–4 |
| §8.2 Host Console | Task 6 |
| §8.3 player audio | Task 7 |
| §8.4 mobile autoplay | Task 7 (tap to enable) |
| §5 admin toggle | Task 5 |
| §9 failure modes | Tasks 4, 7 (503 / unavailable UI) |
| §12 testing | Task 3 unit tests + Task 8 manual |
| Show runner unchanged | No tasks |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-live-audio-host.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement in this session with checkpoints

**Which approach?**
