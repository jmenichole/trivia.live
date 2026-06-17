# trivia.live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship M1 private alpha — a server-authoritative live trivia web PWA with virtual points, elimination gameplay, guest play, admin CMS, and one scheduled show per day.

**Architecture:** Next.js 15 PWA (`apps/web`) handles player UI and API routes. Pure TypeScript game engine (`packages/game-engine`) owns the show state machine and scoring. A Node show-runner worker (`apps/show-runner`) polls Supabase for due shows, advances states on a timer, and broadcasts via Supabase Realtime. Postgres + RLS in Supabase is the source of truth.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Postgres + Auth + Realtime), Vitest, Playwright, Railway (show-runner), Vercel (web)

**Spec:** [`docs/superpowers/specs/2026-06-17-trivia-live-design.md`](../specs/2026-06-17-trivia-live-design.md)

**Locked decisions from spec §16:**
- Show runner → **Railway Node worker** (not Edge Functions; shows run 8–12 min)
- Guest merge → **no mid-show account upgrade**; register after results
- M1 questions → **manual CMS only**
- Discord Activity → **reuse TiltCheck app** (`ActivityType.TRIVIA`) in M2

---

## Target file structure

```
trivia.live/
├── package.json                    # npm workspaces root
├── turbo.json                      # optional; can use npm -w scripts only
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── public/manifest.json
│   │   ├── src/app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # landing + next show countdown
│   │   │   ├── show/[id]/page.tsx       # live game client
│   │   │   ├── leaderboard/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx           # admin auth gate
│   │   │   │   ├── page.tsx             # show list
│   │   │   │   └── shows/[id]/page.tsx  # CMS editor
│   │   │   └── api/
│   │   │       ├── shows/[id]/join/route.ts
│   │   │       ├── shows/[id]/answer/route.ts
│   │   │       └── admin/shows/route.ts
│   │   ├── src/components/
│   │   │   ├── Lobby.tsx
│   │   │   ├── QuestionView.tsx
│   │   │   ├── SpectatorView.tsx
│   │   │   └── ResultsView.tsx
│   │   ├── src/hooks/useShowChannel.ts
│   │   └── src/lib/supabase/
│   │       ├── client.ts
│   │       └── server.ts
│   └── show-runner/
│       ├── package.json
│       ├── src/index.ts                 # poll loop entry
│       ├── src/runShow.ts               # orchestrates one show
│       └── src/supabaseAdmin.ts
├── packages/
│   └── game-engine/
│       ├── package.json
│       ├── src/
│       │   ├── types.ts
│       │   ├── stateMachine.ts
│       │   ├── scoring.ts
│       │   └── index.ts
│       └── src/__tests__/
│           ├── stateMachine.test.ts
│           └── scoring.test.ts
├── supabase/
│   └── migrations/
│       └── 20260617000000_initial_schema.sql
├── e2e/
│   └── show-flow.spec.ts
└── .env.example
```

---

## Phase M1 — Private alpha

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `apps/web/package.json`
- Create: `apps/show-runner/package.json`
- Create: `packages/game-engine/package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create root workspace `package.json`**

```json
{
  "name": "trivia-live",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w @trivia-live/web",
    "dev:runner": "npm run dev -w @trivia-live/show-runner",
    "test": "npm run test -w @trivia-live/game-engine",
    "test:e2e": "playwright test",
    "build": "npm run build -w @trivia-live/web && npm run build -w @trivia-live/show-runner"
  }
}
```

- [ ] **Step 2: Create `packages/game-engine/package.json`**

```json
{
  "name": "@trivia-live/game-engine",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Create `apps/web/package.json` with Next.js 15**

```json
{
  "name": "@trivia-live/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@trivia-live/game-engine": "*",
    "@supabase/supabase-js": "^2.49.0",
    "@supabase/ssr": "^0.6.0",
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create `apps/show-runner/package.json`**

```json
{
  "name": "@trivia-live/show-runner",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@trivia-live/game-engine": "*",
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin CMS (comma-separated Supabase user UUIDs)
ADMIN_USER_IDS=

# Show runner
SHOW_RUNNER_POLL_MS=1000

# TiltCheck perks (M2)
TILTCHECK_PERK_API_URL=
TILTCHECK_PERK_API_KEY=
```

- [ ] **Step 6: Install dependencies**

Run: `cd trivia.live && npm install`
Expected: workspaces linked, no errors

- [ ] **Step 7: Commit**

```bash
git add package.json apps/ packages/ .env.example .gitignore
git commit -m "chore: scaffold trivia.live monorepo workspaces"
```

---

### Task 2: Game engine types

**Files:**
- Create: `packages/game-engine/src/types.ts`
- Create: `packages/game-engine/tsconfig.json`
- Create: `packages/game-engine/vitest.config.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
export type ShowPhase =
  | "scheduled"
  | "lobby"
  | "question"
  | "reveal"
  | "results"
  | "completed"
  | "cancelled";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  orderIndex: number;
  body: string;
  choices: Choice[];
  correctChoiceId: string;
  difficulty: 1 | 2 | 3;
  category: string;
}

export interface ParticipantState {
  playerId: string | null;
  guestToken: string | null;
  eliminatedAtQuestion: number | null;
  extraLifeAvailable: boolean;
  extraLifeUsed: boolean;
}

export interface ShowRuntimeState {
  showId: string;
  phase: ShowPhase;
  questionIndex: number; // 0-based; -1 before first question
  phaseStartedAt: string; // ISO
  questions: Question[];
  participants: Record<string, ParticipantState>; // key = participantKey
  survivorCount: number;
}

export interface AnswerSubmission {
  participantKey: string;
  questionIndex: number;
  choiceId: string | null;
  submittedAt: string; // ISO
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  survivalBonus: number;
  perfectBonus: number;
  spectatorBonus: number;
  total: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/game-engine/
git commit -m "feat(engine): add core show types"
```

---

### Task 3: State machine — failing tests first

**Files:**
- Create: `packages/game-engine/src/__tests__/stateMachine.test.ts`
- Create: `packages/game-engine/src/stateMachine.ts`
- Create: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  advancePhase,
  submitAnswer,
  participantKey,
} from "../stateMachine";
import type { Question } from "../types";

const questions: Question[] = [
  {
    orderIndex: 1,
    body: "What year did the first iPhone launch?",
    choices: [
      { id: "a", text: "2005" },
      { id: "b", text: "2007" },
      { id: "c", text: "2009" },
    ],
    correctChoiceId: "b",
    difficulty: 1,
    category: "tech",
  },
];

describe("createInitialState", () => {
  it("starts in scheduled with no questions active", () => {
    const state = createInitialState("show-1", questions);
    expect(state.phase).toBe("scheduled");
    expect(state.questionIndex).toBe(-1);
  });
});

describe("advancePhase", () => {
  it("moves scheduled → lobby → question", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "lobby");
    expect(state.phase).toBe("lobby");
    state = advancePhase(state, "question");
    expect(state.phase).toBe("question");
    expect(state.questionIndex).toBe(0);
  });
});

describe("submitAnswer", () => {
  it("eliminates on wrong answer without extra life", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "lobby");
    state = advancePhase(state, "question");
    const key = participantKey({ playerId: "p1", guestToken: null });
    state = {
      ...state,
      participants: {
        [key]: {
          playerId: "p1",
          guestToken: null,
          eliminatedAtQuestion: null,
          extraLifeAvailable: false,
          extraLifeUsed: false,
        },
      },
      survivorCount: 1,
    };
    const next = submitAnswer(state, {
      participantKey: key,
      questionIndex: 0,
      choiceId: "a",
      submittedAt: new Date().toISOString(),
    });
    expect(next.participants[key].eliminatedAtQuestion).toBe(1);
    expect(next.survivorCount).toBe(0);
  });

  it("consumes extra life on wrong answer when available", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "question");
    const key = participantKey({ playerId: "p1", guestToken: null });
    state = {
      ...state,
      participants: {
        [key]: {
          playerId: "p1",
          guestToken: null,
          eliminatedAtQuestion: null,
          extraLifeAvailable: true,
          extraLifeUsed: false,
        },
      },
      survivorCount: 1,
    };
    const next = submitAnswer(state, {
      participantKey: key,
      questionIndex: 0,
      choiceId: "a",
      submittedAt: new Date().toISOString(),
    });
    expect(next.participants[key].eliminatedAtQuestion).toBeNull();
    expect(next.participants[key].extraLifeUsed).toBe(true);
    expect(next.survivorCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test -w @trivia-live/game-engine`
Expected: FAIL — module `../stateMachine` not found

- [ ] **Step 3: Implement `stateMachine.ts`**

```typescript
import type {
  AnswerSubmission,
  ParticipantState,
  ShowPhase,
  ShowRuntimeState,
  Question,
} from "./types";

export function participantKey(p: {
  playerId: string | null;
  guestToken: string | null;
}): string {
  if (p.playerId) return `player:${p.playerId}`;
  if (p.guestToken) return `guest:${p.guestToken}`;
  throw new Error("participant must have playerId or guestToken");
}

export function createInitialState(
  showId: string,
  questions: Question[],
): ShowRuntimeState {
  return {
    showId,
    phase: "scheduled",
    questionIndex: -1,
    phaseStartedAt: new Date().toISOString(),
    questions,
    participants: {},
    survivorCount: 0,
  };
}

const PHASE_ORDER: ShowPhase[] = [
  "scheduled",
  "lobby",
  "question",
  "reveal",
  "results",
  "completed",
];

export function advancePhase(
  state: ShowRuntimeState,
  target: ShowPhase,
): ShowRuntimeState {
  const next: ShowRuntimeState = {
    ...state,
    phase: target,
    phaseStartedAt: new Date().toISOString(),
  };
  if (target === "question") {
    const nextIndex =
      state.phase === "reveal" ? state.questionIndex + 1 : 0;
    if (nextIndex >= state.questions.length) {
      return { ...next, phase: "results", questionIndex: state.questionIndex };
    }
    return { ...next, questionIndex: nextIndex };
  }
  if (target === "results") {
    return { ...next, phase: "results" };
  }
  if (target === "completed") {
    return { ...next, phase: "completed" };
  }
  return next;
}

export function submitAnswer(
  state: ShowRuntimeState,
  answer: AnswerSubmission,
): ShowRuntimeState {
  const participant = state.participants[answer.participantKey];
  if (!participant) return state;
  if (participant.eliminatedAtQuestion !== null) return state;
  if (answer.questionIndex !== state.questionIndex) return state;

  const question = state.questions[answer.questionIndex];
  const correct = answer.choiceId === question.correctChoiceId;

  if (correct) return state;

  if (participant.extraLifeAvailable && !participant.extraLifeUsed) {
    const updated: ParticipantState = {
      ...participant,
      extraLifeUsed: true,
    };
    return {
      ...state,
      participants: {
        ...state.participants,
        [answer.participantKey]: updated,
      },
    };
  }

  const updated: ParticipantState = {
    ...participant,
    eliminatedAtQuestion: answer.questionIndex + 1,
  };
  return {
    ...state,
    participants: {
      ...state.participants,
      [answer.participantKey]: updated,
    },
    survivorCount: Math.max(0, state.survivorCount - 1),
  };
}

export function applyTimeouts(
  state: ShowRuntimeState,
  unansweredKeys: string[],
): ShowRuntimeState {
  let next = state;
  for (const key of unansweredKeys) {
    next = submitAnswer(next, {
      participantKey: key,
      questionIndex: state.questionIndex,
      choiceId: null,
      submittedAt: new Date().toISOString(),
    });
  }
  return next;
}
```

- [ ] **Step 4: Export from `index.ts`**

```typescript
export * from "./types";
export * from "./stateMachine";
export * from "./scoring";
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm run test -w @trivia-live/game-engine`
Expected: PASS (scoring tests may fail until Task 4)

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/
git commit -m "feat(engine): add elimination state machine with tests"
```

---

### Task 4: Scoring module

**Files:**
- Create: `packages/game-engine/src/scoring.ts`
- Create: `packages/game-engine/src/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

```typescript
import { describe, it, expect } from "vitest";
import { scoreShow } from "../scoring";

describe("scoreShow", () => {
  it("awards base + speed bonus for correct answers", () => {
    const result = scoreShow({
      answers: [
        { questionIndex: 0, correct: true, difficulty: 2, msRemaining: 5000 },
      ],
      eliminatedAtQuestion: null,
      totalQuestions: 12,
      watchedAsSpectator: false,
    });
    expect(result.base).toBe(200);
    expect(result.speedBonus).toBe(100); // 50% of 200 at 5s/10s
    expect(result.survivalBonus).toBe(500);
    expect(result.perfectBonus).toBe(0);
    expect(result.total).toBe(800);
  });

  it("awards perfect bonus when all correct and not eliminated", () => {
    const answers = Array.from({ length: 12 }, (_, i) => ({
      questionIndex: i,
      correct: true,
      difficulty: 1,
      msRemaining: 8000,
    }));
    const result = scoreShow({
      answers,
      eliminatedAtQuestion: null,
      totalQuestions: 12,
      watchedAsSpectator: false,
    });
    expect(result.perfectBonus).toBe(1000);
  });

  it("awards spectator bonus when eliminated early", () => {
    const result = scoreShow({
      answers: [{ questionIndex: 0, correct: false, difficulty: 1, msRemaining: 0 }],
      eliminatedAtQuestion: 1,
      totalQuestions: 12,
      watchedAsSpectator: true,
    });
    expect(result.spectatorBonus).toBe(50);
    expect(result.survivalBonus).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test -w @trivia-live/game-engine`
Expected: FAIL — `scoreShow` not defined

- [ ] **Step 3: Implement `scoring.ts`**

```typescript
import type { ScoreBreakdown } from "./types";

interface ScoreInput {
  answers: Array<{
    questionIndex: number;
    correct: boolean;
    difficulty: 1 | 2 | 3;
    msRemaining: number;
  }>;
  eliminatedAtQuestion: number | null;
  totalQuestions: number;
  watchedAsSpectator: boolean;
}

const QUESTION_MS = 10_000;
const SURVIVAL_BONUS = 500;
const PERFECT_BONUS = 1000;
const SPECTATOR_BONUS = 50;

export function scoreShow(input: ScoreInput): ScoreBreakdown {
  let base = 0;
  let speedBonus = 0;

  for (const a of input.answers) {
    if (!a.correct) continue;
    const b = 100 * a.difficulty;
    base += b;
    const ratio = Math.max(0, Math.min(1, a.msRemaining / QUESTION_MS));
    speedBonus += Math.round(b * 0.5 * ratio);
  }

  const allCorrect =
    input.eliminatedAtQuestion === null &&
    input.answers.filter((a) => a.correct).length === input.totalQuestions;

  const survivalBonus =
    input.eliminatedAtQuestion === null ? SURVIVAL_BONUS : 0;
  const perfectBonus = allCorrect ? PERFECT_BONUS : 0;
  const spectatorBonus =
    input.eliminatedAtQuestion !== null && input.watchedAsSpectator
      ? SPECTATOR_BONUS
      : 0;

  const total = base + speedBonus + survivalBonus + perfectBonus + spectatorBonus;

  return { base, speedBonus, survivalBonus, perfectBonus, spectatorBonus, total };
}
```

- [ ] **Step 4: Run all engine tests — expect PASS**

Run: `npm run test -w @trivia-live/game-engine`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/
git commit -m "feat(engine): add virtual points scoring with tests"
```

---

### Task 5: Supabase schema migration

**Files:**
- Create: `supabase/migrations/20260617000000_initial_schema.sql`

- [ ] **Step 1: Write migration SQL**

```sql
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
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` (with linked project) or paste into Supabase SQL editor
Expected: tables created

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(db): add initial trivia schema migration"
```

---

### Task 6: Seed script for alpha question set

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed with one 12-question general pop set**

```sql
INSERT INTO question_sets (id, name, theme)
VALUES ('11111111-1111-1111-1111-111111111111', 'Alpha Pop Culture', 'general');

INSERT INTO questions (question_set_id, order_index, body, choices, correct_choice_id, difficulty, category) VALUES
('11111111-1111-1111-1111-111111111111', 1, 'Which film won the Academy Award for Best Picture in 1994?',
 '[{"id":"a","text":"Pulp Fiction"},{"id":"b","text":"Forrest Gump"},{"id":"c","text":"The Shawshank Redemption"}]'::jsonb, 'b', 1, 'movies'),
('11111111-1111-1111-1111-111111111111', 2, 'How many players are on the field for one soccer team during play?',
 '[{"id":"a","text":"9"},{"id":"b","text":"10"},{"id":"c","text":"11"}]'::jsonb, 'c', 1, 'sports'),
('11111111-1111-1111-1111-111111111111', 3, 'What planet is known as the Red Planet?',
 '[{"id":"a","text":"Venus"},{"id":"b","text":"Mars"},{"id":"c","text":"Jupiter"}]'::jsonb, 'b', 1, 'science'),
('11111111-1111-1111-1111-111111111111', 4, 'Who painted the Mona Lisa?',
 '[{"id":"a","text":"Vincent van Gogh"},{"id":"b","text":"Leonardo da Vinci"},{"id":"c","text":"Michelangelo"}]'::jsonb, 'b', 1, 'history'),
('11111111-1111-1111-1111-111111111111', 5, 'Which TV series features the fictional coffee shop Central Perk?',
 '[{"id":"a","text":"Seinfeld"},{"id":"b","text":"Friends"},{"id":"c","text":"How I Met Your Mother"}]'::jsonb, 'b', 1, 'tv'),
('11111111-1111-1111-1111-111111111111', 6, 'What is the chemical symbol for gold?',
 '[{"id":"a","text":"Go"},{"id":"b","text":"Gd"},{"id":"c","text":"Au"}]'::jsonb, 'c', 2, 'science'),
('11111111-1111-1111-1111-111111111111', 7, 'Which artist released the album ''1989''?',
 '[{"id":"a","text":"Adele"},{"id":"b","text":"Taylor Swift"},{"id":"c","text":"Beyoncé"}]'::jsonb, 'b', 1, 'music'),
('11111111-1111-1111-1111-111111111111', 8, 'In what year did World War II end?',
 '[{"id":"a","text":"1943"},{"id":"b","text":"1945"},{"id":"c","text":"1947"}]'::jsonb, 'b', 2, 'history'),
('11111111-1111-1111-1111-111111111111', 9, 'Which company created the character Mario?',
 '[{"id":"a","text":"Sega"},{"id":"b","text":"Nintendo"},{"id":"c","text":"Sony"}]'::jsonb, 'b', 1, 'games'),
('11111111-1111-1111-1111-111111111111', 10, 'What is the capital of Australia?',
 '[{"id":"a","text":"Sydney"},{"id":"b","text":"Melbourne"},{"id":"c","text":"Canberra"}]'::jsonb, 'c', 2, 'geography'),
('11111111-1111-1111-1111-111111111111', 11, 'Which meme features a distracted boyfriend looking at another woman?',
 '[{"id":"a","text":"Doge"},{"id":"b","text":"Distracted Boyfriend"},{"id":"c","text":"Grumpy Cat"}]'::jsonb, 'b', 1, 'memes'),
('11111111-1111-1111-1111-111111111111', 12, 'Who directed ''Jurassic Park'' (1993)?',
 '[{"id":"a","text":"James Cameron"},{"id":"b","text":"Steven Spielberg"},{"id":"c","text":"George Lucas"}]'::jsonb, 'b', 2, 'movies');

INSERT INTO shows (scheduled_at, question_set_id, theme)
VALUES (now() + interval '1 hour', '11111111-1111-1111-1111-111111111111', 'general');
```

- [ ] **Step 2: Run seed against dev Supabase**
- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore(db): add alpha pop culture seed data"
```

---

### Task 7: Next.js web app shell

**Files:**
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/public/manifest.json`

- [ ] **Step 1: Create Supabase browser client**

```typescript
// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create landing page with next show query**

```typescript
// apps/web/src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id, scheduled_at, theme, status")
    .in("status", ["scheduled", "lobby", "live"])
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-3xl font-bold">trivia.live</h1>
      <p className="mt-2 text-neutral-400">Live trivia. Virtual points. No cash.</p>
      {show ? (
        <div className="mt-8 rounded-xl border border-neutral-800 p-4">
          <p className="text-sm uppercase text-neutral-500">Next show</p>
          <p className="text-xl">{new Date(show.scheduled_at).toLocaleString()}</p>
          <Link
            href={`/show/${show.id}`}
            className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 font-medium"
          >
            Join lobby
          </Link>
        </div>
      ) : (
        <p className="mt-8">No upcoming shows. Check back soon.</p>
      )}
      <footer className="mt-16 text-xs text-neutral-600">
        Part of the TiltCheck ecosystem
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Add PWA `manifest.json`**

```json
{
  "name": "trivia.live",
  "short_name": "trivia.live",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#7c3aed",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

- [ ] **Step 4: Verify dev server**

Run: `npm run dev`
Expected: landing page at `http://localhost:3000` shows next seeded show

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add landing page and Supabase wiring"
```

---

### Task 8: Join show API (guest + registered)

**Files:**
- Create: `apps/web/src/app/api/shows/[id]/join/route.ts`

- [ ] **Step 1: Implement POST join handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("id, status, current_phase")
    .eq("id", showId)
    .single();

  if (!show || !["scheduled", "lobby", "live"].includes(show.status)) {
    return NextResponse.json({ error: "Show not joinable" }, { status: 400 });
  }

  let guestToken: string | null = null;
  let playerId: string | null = null;

  if (user) {
    playerId = user.id;
    await admin.from("players").upsert({
      id: user.id,
      display_name: user.user_metadata?.full_name ?? "Player",
    });
  } else {
    guestToken = randomUUID();
  }

  const { data: participant, error } = await admin
    .from("show_participants")
    .insert({
      show_id: showId,
      player_id: playerId,
      guest_token: guestToken,
      extra_life_available: false,
    })
    .select("id, guest_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    participantId: participant.id,
    guestToken: participant.guest_token,
  });
}
```

- [ ] **Step 2: Manual test with curl**

```bash
curl -X POST http://localhost:3000/api/shows/<SHOW_ID>/join
```

Expected: `{ "participantId": "...", "guestToken": "..." }`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/
git commit -m "feat(api): add show join endpoint for guests and auth users"
```

---

### Task 9: Answer submission API

**Files:**
- Create: `apps/web/src/app/api/shows/[id]/answer/route.ts`

- [ ] **Step 1: Implement POST answer handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const body = await req.json();
  const { participantId, questionIndex, choiceId } = body as {
    participantId: string;
    questionIndex: number;
    choiceId: string;
  };

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("current_phase, current_state")
    .eq("id", showId)
    .single();

  if (!show || show.current_phase !== "question") {
    return NextResponse.json({ error: "Not accepting answers" }, { status: 400 });
  }

  const runtime = show.current_state as { questionIndex: number };
  if (runtime.questionIndex !== questionIndex) {
    return NextResponse.json({ error: "Wrong question" }, { status: 400 });
  }

  const { data: question } = await admin
    .from("questions")
    .select("correct_choice_id, difficulty")
    .eq("order_index", questionIndex + 1)
    .single();

  const correct = choiceId === question?.correct_choice_id;

  await admin.from("answers").upsert({
    show_id: showId,
    participant_id: participantId,
    question_index: questionIndex,
    choice_id: choiceId,
    correct,
  });

  return NextResponse.json({ accepted: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/shows/
git commit -m "feat(api): add answer submission endpoint"
```

---

### Task 10: Realtime show channel hook

**Files:**
- Create: `apps/web/src/hooks/useShowChannel.ts`
- Create: `apps/web/src/app/show/[id]/page.tsx`
- Create: `apps/web/src/components/Lobby.tsx`
- Create: `apps/web/src/components/QuestionView.tsx`
- Create: `apps/web/src/components/SpectatorView.tsx`
- Create: `apps/web/src/components/ResultsView.tsx`

- [ ] **Step 1: Implement `useShowChannel`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShowRuntimeState } from "@trivia-live/game-engine";

export function useShowChannel(showId: string) {
  const [state, setState] = useState<ShowRuntimeState | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`show:${showId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shows", filter: `id=eq.${showId}` },
        (payload) => {
          const row = payload.new as { current_state: ShowRuntimeState; current_phase: string };
          setState(row.current_state);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showId]);

  return { state, playerCount };
}
```

- [ ] **Step 2: Build show page switching on `state.phase`**

Render `Lobby` | `QuestionView` | `SpectatorView` | `ResultsView` based on phase and elimination status.

- [ ] **Step 3: Verify realtime updates**

Run show-runner (Task 11) + open two browser tabs on `/show/[id]`
Expected: both tabs advance questions in sync

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add live show client with Realtime subscription"
```

---

### Task 11: Show runner worker

**Files:**
- Create: `apps/show-runner/src/supabaseAdmin.ts`
- Create: `apps/show-runner/src/runShow.ts`
- Create: `apps/show-runner/src/index.ts`
- Create: `apps/show-runner/tsconfig.json`

- [ ] **Step 1: Implement poll loop in `index.ts`**

```typescript
import { runDueShows } from "./runShow.js";

const POLL_MS = Number(process.env.SHOW_RUNNER_POLL_MS ?? 1000);

async function tick() {
  try {
    await runDueShows();
  } catch (err) {
    console.error("[show-runner] tick error", err);
  }
}

console.log("[show-runner] starting");
setInterval(tick, POLL_MS);
tick();
```

- [ ] **Step 2: Implement `runShow.ts` core loop**

Responsibilities per tick for each active show:
1. Load show + questions from DB
2. If `scheduled` and within 5 min of `scheduled_at` → set `lobby`
3. If `lobby` and past `scheduled_at` → set `question` index 0
4. If `question` and 10s elapsed → apply timeouts, set `reveal`
5. If `reveal` and 3s elapsed → either next `question` or `results`
6. If `results` and 30s elapsed → compute scores, set `completed`
7. Persist `current_state` jsonb + broadcast via row UPDATE (Realtime)

Use `@trivia-live/game-engine` `advancePhase`, `applyTimeouts`, `scoreShow`.

- [ ] **Step 3: Run locally alongside web**

Terminal 1: `npm run dev`
Terminal 2: `npm run dev:runner`
Expected: seeded show advances through phases automatically

- [ ] **Step 4: Commit**

```bash
git add apps/show-runner/
git commit -m "feat(runner): add show state machine worker"
```

---

### Task 12: Admin CMS (minimal)

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/api/admin/shows/route.ts`

- [ ] **Step 1: Gate admin routes by `ADMIN_USER_IDS` env**

```typescript
// apps/web/src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admins = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  if (!user || !admins.includes(user.id)) redirect("/");
  return <div className="mx-auto max-w-4xl p-6">{children}</div>;
}
```

- [ ] **Step 2: Admin page lists shows + link to create show with question set dropdown**
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/app/api/admin/
git commit -m "feat(admin): add minimal show CMS with auth gate"
```

---

### Task 13: Playwright E2E — full show flow

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/show-flow.spec.ts`

- [ ] **Step 1: Write E2E test**

```typescript
import { test, expect } from "@playwright/test";

test("guest can join lobby and see question phase", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Join lobby" }).click();
  await expect(page.getByText(/lobby/i)).toBeVisible({ timeout: 30_000 });
  // Wait for question phase (depends on seeded show timing)
  await expect(page.getByRole("button").first()).toBeVisible({ timeout: 120_000 });
});
```

- [ ] **Step 2: Run E2E**

Run: `npx playwright test`
Expected: PASS against local dev + runner

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): add lobby to question flow spec"
```

---

### Task 14: M1 deploy

**Files:**
- Create: `apps/web/vercel.json`
- Create: `apps/show-runner/railway.toml`

- [ ] **Step 1: Deploy web to Vercel** — set env vars from `.env.example`
- [ ] **Step 2: Deploy show-runner to Railway** — same Supabase keys + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Step 3: Smoke test production** — join show from phone browser
- [ ] **Step 4: Commit deploy configs**

```bash
git add apps/web/vercel.json apps/show-runner/railway.toml
git commit -m "chore: add Vercel and Railway deploy configs"
```

**M1 exit criteria:** 50 internal players complete a show without desync.

---

## Phase M2 — Public beta (summary tasks)

> Implement after M1 exit criteria met. Each bullet becomes its own task group with the same step format.

- [ ] **Task M2-1:** Supabase Discord OAuth + `players.discord_id` link flow
- [ ] **Task M2-2:** Perk bridge `apps/web/src/lib/tiltcheck/perks.ts` — calls `GET /api/trivia/perks`, 24h cache, fail-closed
- [ ] **Task M2-3:** TiltCheck monorepo — implement `GET /api/trivia/perks` endpoint verifying extension install
- [ ] **Task M2-4:** Weekly leaderboard page + streak job (cron update `current_streak`)
- [ ] **Task M2-5:** Show-runner emits `trivia.started` webhook to TiltCheck event-router on lobby open
- [ ] **Task M2-6:** Discord Activity route `apps/web/src/app/discord/page.tsx` + token exchange API (reference DAD `POST /api/discord-activity/token`)
- [ ] **Task M2-7:** Web push notifications for PWA installed users

**M2 exit criteria:** 500 DAU peak; perk API live.

---

## Phase M3 — Monetization (summary tasks)

- [ ] **Task M3-1:** Stripe Checkout for cosmetic packs
- [ ] **Task M3-2:** Sponsor fields on `shows` + branded CSS skin per sponsor
- [ ] **Task M3-3:** Extra life IAP with free earn path enforced in code before purchase option shown
- [ ] **Task M3-4:** Terms of service + entertainment-only disclaimer pages

---

## Spec coverage checklist (self-review)

| Spec section | M1 tasks |
|--------------|----------|
| §4 elimination + virtual points | Tasks 3–4, 10–11 |
| §4 guest play | Task 8 |
| §5 state machine | Tasks 3, 11 |
| §6 web PWA | Tasks 7, 10, 14 |
| §7 data model | Task 5 |
| §6.3 CMS | Task 12 |
| §14 late answer reject | Task 9 |
| §15 unit tests | Tasks 3–4 |
| §15 E2E | Task 13 |
| §8 TiltCheck perks | M2-2, M2-3 |
| §8 Discord Activity | M2-6 |
| §9 monetization | M3 |
| §12 DAD separate | documented in spec only |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-trivia-live.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
