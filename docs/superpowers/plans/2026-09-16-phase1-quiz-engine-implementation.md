# Phase 1: Core Quiz Engine & Single Quiz Night — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, testable single quiz night end-to-end: multi-tenant host auth, the full `quiz_state` state machine, MC/free-text/numeric grading, basic anti-cheat signals, and the three views (`/host`, `/projector`, `/play`).

**Architecture:** pnpm monorepo — `apps/api` (NestJS REST, no WebSocket gateway), `apps/web` (single Vite/React PWA with three lazy route trees), `packages/shared-types` (enums/DTOs shared by both). All reads/writes go through NestJS; Supabase Realtime Broadcast is push-only, REST is always the rehydration fallback.

**Tech Stack:** NestJS 10, `@supabase/supabase-js` v2, `@nestjs/jwt`, `@nestjs/config`, `class-validator`/`class-transformer`, `fastest-levenshtein`, Jest (api tests); React 18, Vite, TypeScript, Tailwind CSS, Lucide React, `@vite-pwa/plugin`, Vitest + Testing Library (web tests); Postgres via Supabase.

**Spec:** `docs/superpowers/specs/2026-09-16-phase1-quiz-engine-design.md`

## Global Constraints

- Multi-tenant SaaS: host auth via Supabase Auth; NestJS validates the Supabase JWT on every host-only endpoint.
- All reads/writes go through NestJS REST. Clients never talk to Supabase directly for data. Supabase Realtime Broadcast is used only to push `STATE_CHANGE`/`SCORE_UPDATE` events; `GET /sessions/:id/state` is always available so a missed broadcast is never fatal.
- `leagues` table exists in the schema now but has no endpoints or UI in Phase 1.
- Anti-cheat is basic signals only (Wake Lock, Fullscreen, `visibilitychange`) — infractions are logged and shown to the host; there is **no automatic scoring penalty**.
- Team identity is a NestJS-issued signed token scoped to `{session_id, team_id}`, not a Supabase Auth user. A new join for the same team name invalidates the previous token ("last device wins").
- `submitAnswer` is idempotent via a unique constraint on `(session_id, question_id, team_id)`.
- No browser E2E tests in Phase 1 — unit tests plus one REST integration test covering a full session lifecycle.
- Out of scope for this plan: reconnection/resync hardening beyond the REST fallback, device fingerprinting/trust scoring, rate limiting, leagues UI/aggregation, jokers/wagers/tie-breaks/host takeover (all later phases).

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/src/index.ts`, `packages/shared-types/vitest.config.ts`, `packages/shared-types/src/scaffold.test.ts`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.module.spec.ts`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/vitest.setup.ts`

**Interfaces:**
- Produces: workspace packages `@quizicius/shared-types`, `api`, `web` installable and testable via `pnpm -r test`.

- [ ] **Step 1: Create root workspace config**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "quizicius",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  }
}
```

- [ ] **Step 2: Scaffold `packages/shared-types`**

`packages/shared-types/package.json`:
```json
{
  "name": "@quizicius/shared-types",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

`packages/shared-types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared-types/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node' } });
```

`packages/shared-types/src/index.ts`:
```ts
export const SHARED_TYPES_PACKAGE = '@quizicius/shared-types';
```

`packages/shared-types/src/scaffold.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SHARED_TYPES_PACKAGE } from './index';

describe('scaffold', () => {
  it('package resolves', () => {
    expect(SHARED_TYPES_PACKAGE).toBe('@quizicius/shared-types');
  });
});
```

- [ ] **Step 3: Scaffold `apps/api`**

`apps/api/package.json`:
```json
{
  "name": "api",
  "version": "0.0.1",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/platform-express": "^10.3.0",
    "@quizicius/shared-types": "workspace:*",
    "@supabase/supabase-js": "^2.43.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "fastest-levenshtein": "^1.0.16",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/testing": "^10.3.0",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.12.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "typescript": "^5.4.0"
  },
  "jest": {
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.ts$": "ts-jest" }
  }
}
```

`apps/api/nest-cli.json`:
```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

`apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

`apps/api/src/app.module.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
  });
});
```

- [ ] **Step 4: Scaffold `apps/web`**

`apps/web/package.json`:
```json
{
  "name": "web",
  "version": "0.0.1",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@quizicius/shared-types": "workspace:*",
    "@supabase/supabase-js": "^2.43.0",
    "lucide-react": "^0.372.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.5",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "@vite-pwa/assets-generator": "^0.2.4",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.19.8",
    "vitest": "^1.5.0"
  }
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
```

`apps/web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src"]
}
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Quizicius</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`apps/web/src/App.tsx`:
```tsx
export default function App() {
  return <div>Quizicius</div>;
}
```

`apps/web/src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders', () => {
    render(<App />);
    expect(screen.getByText('Quizicius')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Install and verify**

Run: `pnpm install`
Expected: resolves all three workspace packages without errors.

Run: `pnpm -r test`
Expected: all three scaffold tests PASS.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json packages apps
git commit -m "chore: scaffold monorepo (api, web, shared-types)"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared-types/src/enums.ts`
- Create: `packages/shared-types/src/dto.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/enums.test.ts`

**Interfaces:**
- Produces: `QuizState`, `QuestionType`, `InfractionType`, `GradedBy` enums/unions; `QuizSessionStateDto`, `TeamSummaryDto`, `AnswerSummaryDto` interfaces — consumed by every later task in `apps/api` and `apps/web`.

- [ ] **Step 1: Write the failing test**

`packages/shared-types/src/enums.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { QUIZ_STATES, QUESTION_TYPES, INFRACTION_TYPES } from './enums';

describe('enums', () => {
  it('lists all quiz states from the spec', () => {
    expect(QUIZ_STATES).toEqual([
      'LOBBY',
      'LOCK_IN_ROUND',
      'QUESTION_ACTIVE',
      'QUESTION_REVEAL',
      'PAUSE_BREAK',
      'FINISHED',
    ]);
  });

  it('lists all question types from the spec', () => {
    expect(QUESTION_TYPES).toEqual(['MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST']);
  });

  it('lists all infraction types', () => {
    expect(INFRACTION_TYPES).toEqual(['VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @quizicius/shared-types test`
Expected: FAIL with "Cannot find module './enums'"

- [ ] **Step 3: Implement enums and DTOs**

`packages/shared-types/src/enums.ts`:
```ts
export const QUIZ_STATES = [
  'LOBBY',
  'LOCK_IN_ROUND',
  'QUESTION_ACTIVE',
  'QUESTION_REVEAL',
  'PAUSE_BREAK',
  'FINISHED',
] as const;
export type QuizState = (typeof QUIZ_STATES)[number];

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const INFRACTION_TYPES = ['VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST'] as const;
export type InfractionType = (typeof INFRACTION_TYPES)[number];

export const GRADED_BY = ['AUTO', 'HOST'] as const;
export type GradedBy = (typeof GRADED_BY)[number];
```

`packages/shared-types/src/dto.ts`:
```ts
import { GradedBy, QuestionType, QuizState } from './enums';

export interface QuestionOptionDto {
  id: string;
  label: string;
}

export interface QuestionPublicDto {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOptionDto[] | null;
  points: number;
  timeLimitSeconds: number;
  orderIndex: number;
  // Populated only once the session has reached QUESTION_REVEAL or later — null beforehand so
  // /play and /projector clients can never read the answer before it's meant to be shown.
  correctOptionId: string | null;
  correctNumeric: number | null;
  acceptedAnswers: string[] | null;
}

export interface TeamSummaryDto {
  id: string;
  name: string;
  isActive: boolean;
  score: number;
  infractionCount: number;
}

export interface QuizSessionStateDto {
  id: string;
  joinCode: string;
  status: QuizState;
  currentQuestion: QuestionPublicDto | null;
  questionEndsAt: string | null;
  teams: TeamSummaryDto[];
}

export interface AnswerSummaryDto {
  id: string;
  sessionId: string;
  questionId: string;
  teamId: string;
  response: unknown;
  isCorrect: boolean | null;
  confidence: number | null;
  needsReview: boolean;
  gradedBy: GradedBy | null;
  scoreAwarded: number;
}
```

`packages/shared-types/src/index.ts`:
```ts
export * from './enums';
export * from './dto';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @quizicius/shared-types test`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add quiz enums and shared DTOs"
```

---

## Task 3: Database Migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `profiles`, `leagues`, `quizzes`, `questions`, `quiz_sessions`, `teams`, `answers`, `infractions`; enums `quiz_state`, `question_type`, `infraction_type`, `grader` — consumed by every repository task from Task 8 onward. Column names here are the exact names repositories query against.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_init.sql`:
```sql
create type quiz_state as enum (
  'LOBBY', 'LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'
);

create type question_type as enum (
  'MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST'
);

create type infraction_type as enum (
  'VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST'
);

create type grader as enum ('AUTO', 'HOST');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table leagues (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  league_id uuid references leagues(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  type question_type not null,
  prompt text not null,
  options jsonb,
  accepted_answers text[],
  correct_numeric numeric,
  points integer not null default 1,
  time_limit_seconds integer not null default 30,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  host_id uuid not null references profiles(id) on delete cascade,
  join_code text not null,
  status quiz_state not null default 'LOBBY',
  current_question_id uuid references questions(id),
  question_ends_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Join codes only need to be unique among sessions that are still joinable.
create unique index quiz_sessions_join_code_active_idx
  on quiz_sessions (join_code)
  where status <> 'FINISHED';

create table teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  name text not null,
  device_token_hash text,
  joined_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (session_id, name)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  response jsonb not null,
  is_correct boolean,
  confidence numeric,
  needs_review boolean not null default false,
  graded_by grader,
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  score_awarded integer not null default 0,
  unique (session_id, question_id, team_id)
);

create table infractions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  type infraction_type not null,
  detected_at timestamptz not null default now(),
  reviewed boolean not null default false
);

create index answers_session_needs_review_idx on answers (session_id) where needs_review;
create index infractions_session_idx on infractions (session_id);
```

- [ ] **Step 2: Apply and verify**

Run: `supabase start` (first time only) then `supabase db reset`
Expected: migration applies with no errors; `supabase db diff` reports no drift.

If the Supabase CLI isn't available in this environment, apply directly against a local Postgres and confirm manually:
Run: `psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql`
Then: `psql "$DATABASE_URL" -c "\dt"` and confirm all 8 tables listed above appear.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): add Phase 1 schema migration"
```

---

## Task 4: Config & Supabase Client Wrapper

**Files:**
- Create: `apps/api/.env.example`
- Create: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/supabase/supabase.service.ts`
- Create: `apps/api/src/supabase/supabase.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/supabase/supabase.service.spec.ts`

**Interfaces:**
- Produces: `SupabaseService.getClient(): SupabaseClient` — consumed by every repository (Task 8), `SupabaseAuthGuard` (Task 5), and `RealtimeBroadcastService` (Task 11).

- [ ] **Step 1: Write the failing test**

`apps/api/src/supabase/supabase.service.spec.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  it('builds a client from config values', () => {
    const config = {
      getOrThrow: (key: string) =>
        ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        })[key],
    } as unknown as ConfigService;

    const service = new SupabaseService(config);

    expect(service.getClient()).toBeDefined();
    expect(typeof service.getClient().from).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- supabase.service`
Expected: FAIL with "Cannot find module './supabase.service'"

- [ ] **Step 3: Implement config validation and the client wrapper**

`apps/api/.env.example`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TEAM_TOKEN_SECRET=
PORT=3000
```

`apps/api/src/config/env.validation.ts`:
```ts
import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsString()
  @IsNotEmpty()
  TEAM_TOKEN_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  return validated;
}
```

`apps/api/src/supabase/supabase.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
```

`apps/api/src/supabase/supabase.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- supabase.service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/.env.example apps/api/src/config apps/api/src/supabase apps/api/src/app.module.ts
git commit -m "feat(api): add env validation and Supabase client wrapper"
```

---

## Task 5: Host Auth Guard

**Files:**
- Create: `apps/api/src/auth/supabase-auth.guard.ts`
- Create: `apps/api/src/auth/current-host.decorator.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/supabase-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `SupabaseService.getClient()` from Task 4.
- Produces: `SupabaseAuthGuard` (attaches `req.host = { id: string }` on success), `@CurrentHost()` param decorator returning `{ id: string }` — consumed by every host-only controller (Tasks 12, 15).

- [ ] **Step 1: Write the failing test**

`apps/api/src/auth/supabase-auth.guard.spec.ts`:
```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

function contextWithHeader(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  it('rejects a request with no authorization header', async () => {
    const supabase = { getClient: () => ({}) } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);

    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const supabase = {
      getClient: () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }) },
      }),
    } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);

    await expect(guard.canActivate(contextWithHeader('Bearer bad-token'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches host to the request on a valid token', async () => {
    const supabase = {
      getClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'host-1' } }, error: null }) },
      }),
    } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good-token' } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.host).toEqual({ id: 'host-1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- supabase-auth.guard`
Expected: FAIL with "Cannot find module './supabase-auth.guard'"

- [ ] **Step 3: Implement the guard and decorator**

`apps/api/src/auth/supabase-auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing host token');
    }

    const token = header.slice('Bearer '.length);
    const { data, error } = await this.supabase.getClient().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid host session');
    }

    req.host = { id: data.user.id };
    return true;
  }
}
```

`apps/api/src/auth/current-host.decorator.ts`:
```ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface CurrentHostPayload {
  id: string;
}

export const CurrentHost = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentHostPayload => {
  return ctx.switchToHttp().getRequest().host;
});
```

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- supabase-auth.guard`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): add host auth guard backed by Supabase Auth"
```

---

## Task 6: State Machine Core

**Files:**
- Create: `apps/api/src/quiz-engine/state-transitions.ts`
- Test: `apps/api/src/quiz-engine/state-transitions.spec.ts`

**Interfaces:**
- Consumes: `QuizState` from `@quizicius/shared-types` (Task 2).
- Produces: `isValidTransition(from, to): boolean`, `assertValidTransition(from, to): void`, `InvalidTransitionError` — consumed by `QuizEngineService` (Task 10).

- [ ] **Step 1: Write the failing test**

`apps/api/src/quiz-engine/state-transitions.spec.ts`:
```ts
import { QUIZ_STATES, QuizState } from '@quizicius/shared-types';
import { InvalidTransitionError, assertValidTransition, isValidTransition } from './state-transitions';

const LEGAL: [QuizState, QuizState][] = [
  ['LOBBY', 'LOCK_IN_ROUND'],
  ['LOBBY', 'FINISHED'],
  ['LOCK_IN_ROUND', 'QUESTION_ACTIVE'],
  ['LOCK_IN_ROUND', 'FINISHED'],
  ['QUESTION_ACTIVE', 'QUESTION_REVEAL'],
  ['QUESTION_ACTIVE', 'FINISHED'],
  ['QUESTION_REVEAL', 'LOCK_IN_ROUND'],
  ['QUESTION_REVEAL', 'PAUSE_BREAK'],
  ['QUESTION_REVEAL', 'FINISHED'],
  ['PAUSE_BREAK', 'LOCK_IN_ROUND'],
  ['PAUSE_BREAK', 'FINISHED'],
];

describe('state-transitions', () => {
  it.each(LEGAL)('allows %s -> %s', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it('rejects every other combination', () => {
    const legalSet = new Set(LEGAL.map(([f, t]) => `${f}->${t}`));
    for (const from of QUIZ_STATES) {
      for (const to of QUIZ_STATES) {
        if (!legalSet.has(`${from}->${to}`)) {
          expect(isValidTransition(from, to)).toBe(false);
        }
      }
    }
  });

  it('FINISHED has no outgoing transitions', () => {
    for (const to of QUIZ_STATES) {
      expect(isValidTransition('FINISHED', to)).toBe(false);
    }
  });

  it('assertValidTransition throws InvalidTransitionError on an illegal edge', () => {
    expect(() => assertValidTransition('LOBBY', 'QUESTION_ACTIVE')).toThrow(InvalidTransitionError);
  });

  it('assertValidTransition does not throw on a legal edge', () => {
    expect(() => assertValidTransition('LOBBY', 'LOCK_IN_ROUND')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- state-transitions`
Expected: FAIL with "Cannot find module './state-transitions'"

- [ ] **Step 3: Implement the transition table**

`apps/api/src/quiz-engine/state-transitions.ts`:
```ts
import { QuizState } from '@quizicius/shared-types';

const TRANSITIONS: Record<QuizState, QuizState[]> = {
  LOBBY: ['LOCK_IN_ROUND', 'FINISHED'],
  LOCK_IN_ROUND: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL', 'FINISHED'],
  QUESTION_REVEAL: ['LOCK_IN_ROUND', 'PAUSE_BREAK', 'FINISHED'],
  PAUSE_BREAK: ['LOCK_IN_ROUND', 'FINISHED'],
  FINISHED: [],
};

export function isValidTransition(from: QuizState, to: QuizState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: QuizState,
    public readonly to: QuizState,
  ) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition(from: QuizState, to: QuizState): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- state-transitions`
Expected: PASS (all cases, including the exhaustive 36-combination sweep)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/quiz-engine/state-transitions.ts apps/api/src/quiz-engine/state-transitions.spec.ts
git commit -m "feat(quiz-engine): add validated state transition table"
```

---

## Task 7: Grading Module

**Files:**
- Create: `apps/api/src/quiz-engine/grading/multiple-choice-grader.ts`
- Create: `apps/api/src/quiz-engine/grading/numeric-grader.ts`
- Create: `apps/api/src/quiz-engine/grading/free-text-grader.ts`
- Test: `apps/api/src/quiz-engine/grading/multiple-choice-grader.spec.ts`
- Test: `apps/api/src/quiz-engine/grading/numeric-grader.spec.ts`
- Test: `apps/api/src/quiz-engine/grading/free-text-grader.spec.ts`

**Interfaces:**
- Produces: `gradeMultipleChoice(selectedOptionId, correctOptionId): boolean`, `gradeNumericNearest(answers, correctValue): NumericGradeResult[]`, `gradeFreeText(response, acceptedAnswers): FreeTextGradeResult` — consumed by `QuizEngineService`/answers submission (Tasks 10, 13).

- [ ] **Step 1: Write the failing tests**

`apps/api/src/quiz-engine/grading/multiple-choice-grader.spec.ts`:
```ts
import { gradeMultipleChoice } from './multiple-choice-grader';

describe('gradeMultipleChoice', () => {
  it('is correct when the selected option matches', () => {
    expect(gradeMultipleChoice('opt-a', 'opt-a')).toBe(true);
  });

  it('is incorrect when the selected option does not match', () => {
    expect(gradeMultipleChoice('opt-b', 'opt-a')).toBe(false);
  });
});
```

`apps/api/src/quiz-engine/grading/numeric-grader.spec.ts`:
```ts
import { gradeNumericNearest } from './numeric-grader';

describe('gradeNumericNearest', () => {
  it('returns an empty array for no answers', () => {
    expect(gradeNumericNearest([], 100)).toEqual([]);
  });

  it('marks the single closest answer correct', () => {
    const results = gradeNumericNearest(
      [
        { teamId: 't1', value: 90 },
        { teamId: 't2', value: 150 },
      ],
      100,
    );
    expect(results.find((r) => r.teamId === 't1')).toMatchObject({ isCorrect: true, distance: 10 });
    expect(results.find((r) => r.teamId === 't2')).toMatchObject({ isCorrect: false, distance: 50 });
  });

  it('marks every tied closest answer correct', () => {
    const results = gradeNumericNearest(
      [
        { teamId: 't1', value: 90 },
        { teamId: 't2', value: 110 },
        { teamId: 't3', value: 50 },
      ],
      100,
    );
    expect(results.find((r) => r.teamId === 't1')?.isCorrect).toBe(true);
    expect(results.find((r) => r.teamId === 't2')?.isCorrect).toBe(true);
    expect(results.find((r) => r.teamId === 't3')?.isCorrect).toBe(false);
  });
});
```

`apps/api/src/quiz-engine/grading/free-text-grader.spec.ts`:
```ts
import { gradeFreeText, normalizeAnswer } from './free-text-grader';

describe('normalizeAnswer', () => {
  it('lowercases, strips punctuation and diacritics, and collapses whitespace', () => {
    expect(normalizeAnswer('  Zürich,  Switzerland! ')).toBe('zurich switzerland');
  });
});

describe('gradeFreeText', () => {
  it('auto-accepts an exact match', () => {
    const result = gradeFreeText('Paris', ['Paris']);
    expect(result).toMatchObject({ isCorrect: true, needsReview: false, matchedAnswer: 'Paris' });
    expect(result.confidence).toBe(1);
  });

  it('auto-accepts reordered words via token-sort comparison', () => {
    const result = gradeFreeText('France, Paris', ['Paris, France']);
    expect(result).toMatchObject({ isCorrect: true, needsReview: false });
  });

  it('sends a close-but-not-exact answer to review', () => {
    // "Pahris" vs "Paris": edit distance 1 over max length 6 -> confidence ~0.83, but with the
    // extra token-sort pass on single words this still lands in the review band for a near-miss.
    const result = gradeFreeText('Pahhris', ['Paris']);
    expect(result.needsReview).toBe(true);
    expect(result.isCorrect).toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  it('auto-rejects an unrelated answer', () => {
    const result = gradeFreeText('Berlin', ['Paris']);
    expect(result).toMatchObject({ isCorrect: false, needsReview: false });
  });

  it('picks the best match across multiple accepted answers', () => {
    const result = gradeFreeText('JFK', ['John F. Kennedy', 'JFK']);
    expect(result).toMatchObject({ isCorrect: true, matchedAnswer: 'JFK' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- grading`
Expected: FAIL with "Cannot find module" for all three graders.

- [ ] **Step 3: Add the Levenshtein dependency and implement the graders**

Run: `pnpm --filter api add fastest-levenshtein`

`apps/api/src/quiz-engine/grading/multiple-choice-grader.ts`:
```ts
export function gradeMultipleChoice(selectedOptionId: string, correctOptionId: string): boolean {
  return selectedOptionId === correctOptionId;
}
```

`apps/api/src/quiz-engine/grading/numeric-grader.ts`:
```ts
export interface NumericAnswer {
  teamId: string;
  value: number;
}

export interface NumericGradeResult {
  teamId: string;
  distance: number;
  isCorrect: boolean;
}

export function gradeNumericNearest(answers: NumericAnswer[], correctValue: number): NumericGradeResult[] {
  if (answers.length === 0) return [];

  const withDistance = answers.map((a) => ({ ...a, distance: Math.abs(a.value - correctValue) }));
  const minDistance = Math.min(...withDistance.map((a) => a.distance));

  return withDistance.map(({ teamId, distance }) => ({
    teamId,
    distance,
    isCorrect: distance === minDistance,
  }));
}
```

`apps/api/src/quiz-engine/grading/free-text-grader.ts`:
```ts
import { distance } from 'fastest-levenshtein';

export interface FreeTextGradeResult {
  isCorrect: boolean | null;
  needsReview: boolean;
  confidence: number;
  matchedAnswer: string | null;
}

export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSort(normalized: string): string {
  return normalized.split(' ').filter(Boolean).sort().join(' ');
}

function similarity(a: string, b: string): number {
  const sortedA = tokenSort(a);
  const sortedB = tokenSort(b);
  const maxLen = Math.max(sortedA.length, sortedB.length);
  if (maxLen === 0) return 1;
  return 1 - distance(sortedA, sortedB) / maxLen;
}

const AUTO_ACCEPT_THRESHOLD = 0.8;
const REVIEW_THRESHOLD = 0.5;

export function gradeFreeText(response: string, acceptedAnswers: string[]): FreeTextGradeResult {
  const normalizedResponse = normalizeAnswer(response);

  let best: { answer: string | null; confidence: number } = { answer: null, confidence: 0 };
  for (const accepted of acceptedAnswers) {
    const confidence = similarity(normalizedResponse, normalizeAnswer(accepted));
    if (confidence > best.confidence) {
      best = { answer: accepted, confidence };
    }
  }

  if (best.confidence > AUTO_ACCEPT_THRESHOLD) {
    return { isCorrect: true, needsReview: false, confidence: best.confidence, matchedAnswer: best.answer };
  }
  if (best.confidence >= REVIEW_THRESHOLD) {
    return { isCorrect: null, needsReview: true, confidence: best.confidence, matchedAnswer: best.answer };
  }
  return { isCorrect: false, needsReview: false, confidence: best.confidence, matchedAnswer: best.answer };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- grading`
Expected: PASS (all cases across the three grader spec files)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/quiz-engine/grading apps/api/package.json apps/api/pnpm-lock.yaml
git commit -m "feat(quiz-engine): add multiple-choice, numeric, and free-text graders"
```

---

## Task 8: Data Repositories

**Files:**
- Create: `apps/api/src/test-utils/supabase-mock.ts`
- Create: `apps/api/src/data/sessions.repository.ts`
- Create: `apps/api/src/data/questions.repository.ts`
- Create: `apps/api/src/data/teams.repository.ts`
- Create: `apps/api/src/data/answers.repository.ts`
- Create: `apps/api/src/data/data.module.ts`
- Test: `apps/api/src/data/sessions.repository.spec.ts`
- Test: `apps/api/src/data/questions.repository.spec.ts`
- Test: `apps/api/src/data/teams.repository.spec.ts`
- Test: `apps/api/src/data/answers.repository.spec.ts`

**Interfaces:**
- Consumes: `SupabaseService.getClient()` (Task 4); `QuizState`, `QuestionType`, `GradedBy` (Task 2).
- Produces: abstract classes `SessionsRepository`, `QuestionsRepository`, `TeamsRepository`, `AnswersRepository` used as DI tokens, each with a Supabase-backed implementation registered in `DataModule`. Real code depends on the abstract class (constructor-injects `SessionsRepository`, etc.); tests substitute in-memory implementations of the same abstract class. Exact methods:
  - `SessionsRepository.create(quizId, hostId, joinCode): Promise<SessionRecord>`
  - `SessionsRepository.findById(id): Promise<SessionRecord | null>`
  - `SessionsRepository.updateStatus(id, patch): Promise<SessionRecord>`
  - `QuestionsRepository.findById(id): Promise<QuestionRecord | null>`
  - `QuestionsRepository.listByQuiz(quizId): Promise<QuestionRecord[]>`
  - `QuestionsRepository.create(quizId, input): Promise<QuestionRecord>`
  - `TeamsRepository.findById(teamId): Promise<TeamRecord | null>`
  - `TeamsRepository.findBySessionAndName(sessionId, name): Promise<TeamRecord | null>`
  - `TeamsRepository.upsertJoin(sessionId, name): Promise<TeamRecord>` (creates or reactivates a team row by name; does not set the token — the token is signed afterward because it embeds the DB-generated team id)
  - `TeamsRepository.setDeviceTokenHash(teamId, tokenHash): Promise<TeamRecord>`
  - `TeamsRepository.listBySession(sessionId): Promise<TeamRecord[]>`
  - `AnswersRepository.upsertSubmission(input): Promise<AnswerRecord>`
  - `AnswersRepository.findById(id): Promise<AnswerRecord | null>`
  - `AnswersRepository.listByQuestion(sessionId, questionId): Promise<AnswerRecord[]>`
  - `AnswersRepository.listNeedsReview(sessionId): Promise<AnswerRecord[]>`
  - `AnswersRepository.updateGrade(id, patch): Promise<AnswerRecord>`

- [ ] **Step 1: Write the shared Supabase test mock**

`apps/api/src/test-utils/supabase-mock.ts`:
```ts
import { SupabaseService } from '../supabase/supabase.service';

interface MockResult {
  data: unknown;
  error: { message: string } | null;
}

function fluentBuilder(result: MockResult): PromiseLike<MockResult> & Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => Promise.resolve(result),
    then: (onResolve: (value: MockResult) => unknown) => Promise.resolve(result).then(onResolve),
  };
  return builder as PromiseLike<MockResult> & Record<string, unknown>;
}

export function fakeSupabaseService(resultsByTable: Record<string, MockResult>): SupabaseService {
  return {
    getClient: () => ({
      from: (table: string) => fluentBuilder(resultsByTable[table]),
    }),
  } as unknown as SupabaseService;
}
```

- [ ] **Step 2: Write the failing repository tests**

`apps/api/src/data/sessions.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseSessionsRepository, SessionRecord } from './sessions.repository';

const RECORD: SessionRecord = {
  id: 's1',
  quiz_id: 'q1',
  host_id: 'h1',
  join_code: 'AB12',
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

describe('SupabaseSessionsRepository', () => {
  it('creates a session in LOBBY status', async () => {
    const supabase = fakeSupabaseService({ quiz_sessions: { data: RECORD, error: null } });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.create('q1', 'h1', 'AB12')).resolves.toEqual(RECORD);
  });

  it('returns null when a session is not found', async () => {
    const supabase = fakeSupabaseService({
      quiz_sessions: { data: null, error: { message: 'not found' } },
    });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  it('applies a status patch', async () => {
    const updated = { ...RECORD, status: 'LOCK_IN_ROUND' as const };
    const supabase = fakeSupabaseService({ quiz_sessions: { data: updated, error: null } });
    const repo = new SupabaseSessionsRepository(supabase);

    await expect(repo.updateStatus('s1', { status: 'LOCK_IN_ROUND' })).resolves.toEqual(updated);
  });
});
```

`apps/api/src/data/questions.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseQuestionsRepository, QuestionRecord } from './questions.repository';

const RECORD: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Capital of France?',
  options: [{ id: 'a', label: 'Paris', isCorrect: true }],
  accepted_answers: null,
  correct_numeric: null,
  points: 1,
  time_limit_seconds: 30,
  order_index: 0,
};

describe('SupabaseQuestionsRepository', () => {
  it('creates a question under a quiz', async () => {
    const supabase = fakeSupabaseService({ questions: { data: RECORD, error: null } });
    const repo = new SupabaseQuestionsRepository(supabase);

    const { id, quiz_id, ...input } = RECORD;
    await expect(repo.create('quiz1', input)).resolves.toEqual(RECORD);
  });

  it('lists questions for a quiz', async () => {
    const supabase = fakeSupabaseService({ questions: { data: [RECORD], error: null } });
    const repo = new SupabaseQuestionsRepository(supabase);

    await expect(repo.listByQuiz('quiz1')).resolves.toEqual([RECORD]);
  });
});
```

`apps/api/src/data/teams.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseTeamsRepository, TeamRecord } from './teams.repository';

const RECORD: TeamRecord = {
  id: 't1',
  session_id: 's1',
  name: 'The Quizzards',
  device_token_hash: 'hash-1',
  joined_at: '2026-09-16T00:00:00.000Z',
  is_active: true,
};

describe('SupabaseTeamsRepository', () => {
  it('upserts a join, reactivating an existing team by name', async () => {
    const supabase = fakeSupabaseService({ teams: { data: RECORD, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.upsertJoin('s1', 'The Quizzards')).resolves.toEqual(RECORD);
  });

  it('stamps the device token hash after a team id is known', async () => {
    const withHash = { ...RECORD, device_token_hash: 'hash-1' };
    const supabase = fakeSupabaseService({ teams: { data: withHash, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.setDeviceTokenHash('t1', 'hash-1')).resolves.toEqual(withHash);
  });

  it('lists teams for a session', async () => {
    const supabase = fakeSupabaseService({ teams: { data: [RECORD], error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });

  it('finds a team by id', async () => {
    const supabase = fakeSupabaseService({ teams: { data: RECORD, error: null } });
    const repo = new SupabaseTeamsRepository(supabase);

    await expect(repo.findById('t1')).resolves.toEqual(RECORD);
  });
});
```

`apps/api/src/data/answers.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { SupabaseAnswersRepository, AnswerRecord } from './answers.repository';

const RECORD: AnswerRecord = {
  id: 'a1',
  session_id: 's1',
  question_id: 'q1',
  team_id: 't1',
  response: { optionId: 'a' },
  is_correct: null,
  confidence: null,
  needs_review: false,
  graded_by: null,
  graded_at: null,
  submitted_at: '2026-09-16T00:00:00.000Z',
  score_awarded: 0,
};

describe('SupabaseAnswersRepository', () => {
  it('upserts a submission idempotently', async () => {
    const supabase = fakeSupabaseService({ answers: { data: RECORD, error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(
      repo.upsertSubmission({ sessionId: 's1', questionId: 'q1', teamId: 't1', response: { optionId: 'a' } }),
    ).resolves.toEqual(RECORD);
  });

  it('applies a grade patch', async () => {
    const graded = { ...RECORD, is_correct: true, graded_by: 'AUTO' as const, score_awarded: 1 };
    const supabase = fakeSupabaseService({ answers: { data: graded, error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(
      repo.updateGrade('a1', { is_correct: true, graded_by: 'AUTO', score_awarded: 1 }),
    ).resolves.toEqual(graded);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter api test -- data/`
Expected: FAIL with "Cannot find module" for each repository file.

- [ ] **Step 4: Implement the repositories**

`apps/api/src/data/sessions.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QuizState } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface SessionRecord {
  id: string;
  quiz_id: string;
  host_id: string;
  join_code: string;
  status: QuizState;
  current_question_id: string | null;
  question_ends_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type SessionStatusPatch = Partial<
  Pick<SessionRecord, 'status' | 'current_question_id' | 'question_ends_at' | 'started_at' | 'finished_at'>
>;

export abstract class SessionsRepository {
  abstract create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord>;
  abstract findById(id: string): Promise<SessionRecord | null>;
  abstract updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord>;
}

@Injectable()
export class SupabaseSessionsRepository extends SessionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .insert({ quiz_id: quizId, host_id: hostId, join_code: joinCode, status: 'LOBBY' })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const { data, error } = await this.supabase.getClient().from('quiz_sessions').select().eq('id', id).single();
    if (error) return null;
    return data as SessionRecord;
  }

  async updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }
}
```

`apps/api/src/data/questions.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QuestionType } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  type: QuestionType;
  prompt: string;
  options: { id: string; label: string; isCorrect: boolean }[] | null;
  accepted_answers: string[] | null;
  correct_numeric: number | null;
  points: number;
  time_limit_seconds: number;
  order_index: number;
}

export abstract class QuestionsRepository {
  abstract findById(id: string): Promise<QuestionRecord | null>;
  abstract listByQuiz(quizId: string): Promise<QuestionRecord[]>;
  abstract create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord>;
}

@Injectable()
export class SupabaseQuestionsRepository extends QuestionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<QuestionRecord | null> {
    const { data, error } = await this.supabase.getClient().from('questions').select().eq('id', id).single();
    if (error) return null;
    return data as QuestionRecord;
  }

  async listByQuiz(quizId: string): Promise<QuestionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .select()
      .eq('quiz_id', quizId)
      .order('order_index');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as QuestionRecord[];
  }

  async create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .insert({ quiz_id: quizId, ...input })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuestionRecord;
  }
}
```

`apps/api/src/data/teams.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TeamRecord {
  id: string;
  session_id: string;
  name: string;
  device_token_hash: string | null;
  joined_at: string;
  is_active: boolean;
}

export abstract class TeamsRepository {
  abstract findById(teamId: string): Promise<TeamRecord | null>;
  abstract findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null>;
  abstract upsertJoin(sessionId: string, name: string): Promise<TeamRecord>;
  abstract setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord>;
  abstract listBySession(sessionId: string): Promise<TeamRecord[]>;
}

@Injectable()
export class SupabaseTeamsRepository extends TeamsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(teamId: string): Promise<TeamRecord | null> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('id', teamId).single();
    if (error) return null;
    return data as TeamRecord;
  }

  async findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .select()
      .eq('session_id', sessionId)
      .eq('name', name)
      .single();
    if (error) return null;
    return data as TeamRecord;
  }

  async upsertJoin(sessionId: string, name: string): Promise<TeamRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .upsert(
        { session_id: sessionId, name, is_active: true, joined_at: new Date().toISOString() },
        { onConflict: 'session_id,name' },
      )
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('teams')
      .update({ device_token_hash: tokenHash })
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as TeamRecord;
  }

  async listBySession(sessionId: string): Promise<TeamRecord[]> {
    const { data, error } = await this.supabase.getClient().from('teams').select().eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as TeamRecord[];
  }
}
```

`apps/api/src/data/answers.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GradedBy } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface AnswerRecord {
  id: string;
  session_id: string;
  question_id: string;
  team_id: string;
  response: unknown;
  is_correct: boolean | null;
  confidence: number | null;
  needs_review: boolean;
  graded_by: GradedBy | null;
  graded_at: string | null;
  submitted_at: string;
  score_awarded: number;
}

export type AnswerGradePatch = Partial<
  Pick<AnswerRecord, 'is_correct' | 'confidence' | 'needs_review' | 'graded_by' | 'graded_at' | 'score_awarded'>
>;

export abstract class AnswersRepository {
  abstract upsertSubmission(input: {
    sessionId: string;
    questionId: string;
    teamId: string;
    response: unknown;
  }): Promise<AnswerRecord>;
  abstract findById(id: string): Promise<AnswerRecord | null>;
  abstract listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]>;
  abstract listNeedsReview(sessionId: string): Promise<AnswerRecord[]>;
  abstract updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord>;
}

@Injectable()
export class SupabaseAnswersRepository extends AnswersRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async upsertSubmission(input: {
    sessionId: string;
    questionId: string;
    teamId: string;
    response: unknown;
  }): Promise<AnswerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .upsert(
        {
          session_id: input.sessionId,
          question_id: input.questionId,
          team_id: input.teamId,
          response: input.response,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,question_id,team_id' },
      )
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }

  async findById(id: string): Promise<AnswerRecord | null> {
    const { data, error } = await this.supabase.getClient().from('answers').select().eq('id', id).single();
    if (error) return null;
    return data as AnswerRecord;
  }

  async listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .select()
      .eq('session_id', sessionId)
      .eq('question_id', questionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }

  async listNeedsReview(sessionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .select()
      .eq('session_id', sessionId)
      .eq('needs_review', true);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }

  async updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .update({ ...patch, graded_at: patch.graded_at ?? new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }
}
```

`apps/api/src/data/data.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { AnswersRepository, SupabaseAnswersRepository } from './answers.repository';
import { QuestionsRepository, SupabaseQuestionsRepository } from './questions.repository';
import { SessionsRepository, SupabaseSessionsRepository } from './sessions.repository';
import { SupabaseTeamsRepository, TeamsRepository } from './teams.repository';

@Global()
@Module({
  providers: [
    { provide: SessionsRepository, useClass: SupabaseSessionsRepository },
    { provide: QuestionsRepository, useClass: SupabaseQuestionsRepository },
    { provide: TeamsRepository, useClass: SupabaseTeamsRepository },
    { provide: AnswersRepository, useClass: SupabaseAnswersRepository },
  ],
  exports: [SessionsRepository, QuestionsRepository, TeamsRepository, AnswersRepository],
})
export class DataModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter api test -- data/`
Expected: PASS across all four repository spec files.

- [ ] **Step 6: Wire `DataModule` into the app and commit**

Add `DataModule` to the `imports` array in `apps/api/src/app.module.ts` (alongside `SupabaseModule`).

```bash
git add apps/api/src/test-utils apps/api/src/data apps/api/src/app.module.ts
git commit -m "feat(api): add Supabase-backed repositories for sessions/questions/teams/answers"
```

---

## Task 9: Team Token Service & Guard

**Files:**
- Create: `apps/api/src/teams/hash-token.ts`
- Create: `apps/api/src/teams/team-token.service.ts`
- Create: `apps/api/src/teams/team-token.guard.ts`
- Test: `apps/api/src/teams/hash-token.spec.ts`
- Test: `apps/api/src/teams/team-token.service.spec.ts`
- Test: `apps/api/src/teams/team-token.guard.spec.ts`

**Interfaces:**
- Consumes: `TeamsRepository` (Task 8, as modified above).
- Produces: `hashToken(token: string): string`; `TeamTokenService.sign(payload: TeamTokenPayload): string`, `TeamTokenService.verify(token: string): TeamTokenPayload` where `TeamTokenPayload = { sessionId: string; teamId: string }`; `TeamTokenGuard` (attaches `req.team: TeamTokenPayload`, and rejects a token whose hash no longer matches the team's stored `device_token_hash` — this is what makes "last device wins" actually revoke the old device, since JWT signature verification alone can't do that) — consumed by Teams (Task 12), Answers (Task 13), Infractions (Task 14) modules.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/teams/hash-token.spec.ts`:
```ts
import { hashToken } from './hash-token';

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('differs for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
```

`apps/api/src/teams/team-token.service.spec.ts`:
```ts
import { JwtService } from '@nestjs/jwt';
import { TeamTokenService } from './team-token.service';

describe('TeamTokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new TeamTokenService(jwt);

  it('round-trips a signed payload', () => {
    const token = service.sign({ sessionId: 's1', teamId: 't1' });
    expect(service.verify(token)).toMatchObject({ sessionId: 's1', teamId: 't1' });
  });

  it('throws on a garbage token', () => {
    expect(() => service.verify('not-a-token')).toThrow();
  });
});
```

`apps/api/src/teams/team-token.guard.spec.ts`:
```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenGuard } from './team-token.guard';
import { TeamTokenService } from './team-token.service';

function contextWithHeader(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function buildTeam(overrides?: Partial<TeamRecord>): TeamRecord {
  return {
    id: 't1',
    session_id: 's1',
    name: 'The Quizzards',
    device_token_hash: null,
    joined_at: '2026-09-16T00:00:00.000Z',
    is_active: true,
    ...overrides,
  };
}

describe('TeamTokenGuard', () => {
  const teamTokens = new TeamTokenService(new JwtService({ secret: 'test-secret' }));

  it('rejects a missing token', async () => {
    const teams = { findById: jest.fn() } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const teams = { findById: jest.fn() } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader('Bearer garbage'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a validly-signed token that was superseded by a later join ("last device wins")', async () => {
    const token = teamTokens.sign({ sessionId: 's1', teamId: 't1' });
    const teams = {
      findById: jest.fn().mockResolvedValue(buildTeam({ device_token_hash: hashToken('a-newer-token') })),
    } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader(`Bearer ${token}`))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the team payload when the token hash matches the current device', async () => {
    const token = teamTokens.sign({ sessionId: 's1', teamId: 't1' });
    const teams = {
      findById: jest.fn().mockResolvedValue(buildTeam({ device_token_hash: hashToken(token) })),
    } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.team).toMatchObject({ sessionId: 's1', teamId: 't1' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- teams/`
Expected: FAIL with "Cannot find module" for all three source files.

- [ ] **Step 3: Implement the hash utility, token service, and guard**

`apps/api/src/teams/hash-token.ts`:
```ts
import { createHash } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

`apps/api/src/teams/team-token.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface TeamTokenPayload {
  sessionId: string;
  teamId: string;
}

@Injectable()
export class TeamTokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: TeamTokenPayload): string {
    return this.jwt.sign(payload, { expiresIn: '6h' });
  }

  verify(token: string): TeamTokenPayload {
    return this.jwt.verify<TeamTokenPayload>(token);
  }
}
```

`apps/api/src/teams/team-token.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';

@Injectable()
export class TeamTokenGuard implements CanActivate {
  constructor(
    private readonly teamTokens: TeamTokenService,
    private readonly teams: TeamsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing team token');
    }
    const token = header.slice('Bearer '.length);

    const payload = (() => {
      try {
        return this.teamTokens.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired team token');
      }
    })();

    const team = await this.teams.findById(payload.teamId);
    if (!team || team.device_token_hash !== hashToken(token)) {
      throw new UnauthorizedException('This team is now active on another device');
    }

    req.team = payload;
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- teams/`
Expected: PASS (8 tests across the three files)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/teams/hash-token.ts apps/api/src/teams/hash-token.spec.ts apps/api/src/teams/team-token.service.ts apps/api/src/teams/team-token.guard.ts apps/api/src/teams/team-token.service.spec.ts apps/api/src/teams/team-token.guard.spec.ts
git commit -m "feat(api): add signed team tokens with device-hash revocation on rejoin"
```

---

## Task 10: Realtime Broadcast Service

**Files:**
- Create: `apps/api/src/realtime/realtime-broadcast.service.ts`
- Create: `apps/api/src/realtime/realtime.module.ts`
- Test: `apps/api/src/realtime/realtime-broadcast.service.spec.ts`

**Interfaces:**
- Consumes: `SupabaseService.getClient()` (Task 4).
- Produces: `RealtimeBroadcastService.publish(sessionId: string, event: 'STATE_CHANGE' | 'SCORE_UPDATE', payload: Record<string, unknown>): Promise<void>` — consumed by `QuizEngineService` (Task 11).

- [ ] **Step 1: Write the failing test**

`apps/api/src/realtime/realtime-broadcast.service.spec.ts`:
```ts
import { RealtimeBroadcastService } from './realtime-broadcast.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('RealtimeBroadcastService', () => {
  it('sends a broadcast event on the session channel', async () => {
    const send = jest.fn().mockResolvedValue({ status: 'ok' });
    const channel = jest.fn().mockReturnValue({ send });
    const supabase = { getClient: () => ({ channel }) } as unknown as SupabaseService;

    const service = new RealtimeBroadcastService(supabase);
    await service.publish('session-1', 'STATE_CHANGE', { status: 'LOCK_IN_ROUND' });

    expect(channel).toHaveBeenCalledWith('quiz:session-1');
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'STATE_CHANGE',
      payload: { status: 'LOCK_IN_ROUND' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- realtime-broadcast`
Expected: FAIL with "Cannot find module './realtime-broadcast.service'"

- [ ] **Step 3: Implement the broadcast service**

`apps/api/src/realtime/realtime-broadcast.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type BroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE';

@Injectable()
export class RealtimeBroadcastService {
  constructor(private readonly supabase: SupabaseService) {}

  async publish(sessionId: string, event: BroadcastEvent, payload: Record<string, unknown>): Promise<void> {
    const channel = this.supabase.getClient().channel(`quiz:${sessionId}`);
    await channel.send({ type: 'broadcast', event, payload });
  }
}
```

`apps/api/src/realtime/realtime.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { RealtimeBroadcastService } from './realtime-broadcast.service';

@Global()
@Module({
  providers: [RealtimeBroadcastService],
  exports: [RealtimeBroadcastService],
})
export class RealtimeModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- realtime-broadcast`
Expected: PASS

- [ ] **Step 5: Wire `RealtimeModule` into the app and commit**

Add `RealtimeModule` to `imports` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/realtime apps/api/src/app.module.ts
git commit -m "feat(api): add Supabase Realtime broadcast service"
```

---

## Task 11: Quiz Engine Service

**Files:**
- Create: `apps/api/src/quiz-engine/join-code.ts`
- Test: `apps/api/src/quiz-engine/join-code.spec.ts`
- Modify: `apps/api/src/data/answers.repository.ts` (add `listBySession`)
- Modify: `apps/api/src/data/answers.repository.spec.ts` (test `listBySession`)
- Create: `apps/api/src/quiz-engine/quiz-engine.service.ts`
- Create: `apps/api/src/quiz-engine/quiz-engine.module.ts`
- Test: `apps/api/src/quiz-engine/quiz-engine.service.spec.ts`

**Interfaces:**
- Consumes: `SessionsRepository`, `QuestionsRepository`, `TeamsRepository`, `AnswersRepository` (Task 8), `RealtimeBroadcastService` (Task 10), `assertValidTransition`/`InvalidTransitionError` (Task 6), `gradeNumericNearest` (Task 7), `QuizSessionStateDto`/`TeamSummaryDto` (Task 2).
- Produces:
  - `QuizEngineService.createSession(quizId, hostId): Promise<SessionRecord>`
  - `QuizEngineService.getState(sessionId): Promise<QuizSessionStateDto>`
  - `QuizEngineService.transitionState(sessionId, hostId, newState, options?: { questionId?: string }): Promise<SessionRecord>`
  - `QuizEngineService.resolveDispute(answerId, hostId, decision: 'APPROVE' | 'REJECT'): Promise<AnswerRecord>`
  - consumed by Sessions/Answers controllers (Tasks 13, 15). `TeamSummaryDto.infractionCount` is hardcoded to `0` here — Task 14 modifies `getState` to wire in the real `InfractionsRepository` count.

- [ ] **Step 1: Write the failing join-code test**

`apps/api/src/quiz-engine/join-code.spec.ts`:
```ts
import { generateJoinCode } from './join-code';

describe('generateJoinCode', () => {
  it('generates a 4-character code from the unambiguous alphabet', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it('generates different codes across calls (probabilistically)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then implement**

Run: `pnpm --filter api test -- join-code`
Expected: FAIL with "Cannot find module './join-code'"

`apps/api/src/quiz-engine/join-code.ts`:
```ts
// Excludes 0/O and 1/I so a host can read a code aloud without ambiguity.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
```

Run: `pnpm --filter api test -- join-code`
Expected: PASS

- [ ] **Step 3: Add `listBySession` to `AnswersRepository`**

Add to the `AnswersRepository` abstract class in `apps/api/src/data/answers.repository.ts`:
```ts
  abstract listBySession(sessionId: string): Promise<AnswerRecord[]>;
```

Add to `SupabaseAnswersRepository` in the same file:
```ts
  async listBySession(sessionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase.getClient().from('answers').select().eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }
```

Add to `apps/api/src/data/answers.repository.spec.ts`:
```ts
describe('SupabaseAnswersRepository.listBySession', () => {
  it('lists all answers for a session', async () => {
    const supabase = fakeSupabaseService({ answers: { data: [RECORD], error: null } });
    const repo = new SupabaseAnswersRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
```

Run: `pnpm --filter api test -- data/answers.repository`
Expected: PASS

- [ ] **Step 4: Write the failing `QuizEngineService` tests**

`apps/api/src/quiz-engine/quiz-engine.service.spec.ts`:
```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { InvalidTransitionError } from './state-transitions';
import { QuizEngineService } from './quiz-engine.service';

const BASE_SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

const NUMERIC_QUESTION: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'NUMERIC_NEAREST',
  prompt: 'Population of Slovakia (millions)?',
  options: null,
  accepted_answers: null,
  correct_numeric: 5.4,
  points: 4,
  time_limit_seconds: 20,
  order_index: 0,
};

function buildHarness(overrides?: { session?: Partial<SessionRecord> }) {
  const session = { ...BASE_SESSION, ...overrides?.session };

  const sessions: SessionsRepository = {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(session),
    updateStatus: jest.fn().mockImplementation(async (_id: string, patch) => ({ ...session, ...patch })),
  };
  const questions: QuestionsRepository = {
    findById: jest.fn().mockResolvedValue(NUMERIC_QUESTION),
    listByQuiz: jest.fn(),
    create: jest.fn(),
  };
  const teams: TeamsRepository = {
    findById: jest.fn(),
    findBySessionAndName: jest.fn(),
    upsertJoin: jest.fn(),
    setDeviceTokenHash: jest.fn(),
    listBySession: jest.fn().mockResolvedValue([] as TeamRecord[]),
  };
  const answers: AnswersRepository = {
    upsertSubmission: jest.fn(),
    findById: jest.fn(),
    listByQuestion: jest.fn().mockResolvedValue([] as AnswerRecord[]),
    listNeedsReview: jest.fn(),
    listBySession: jest.fn().mockResolvedValue([] as AnswerRecord[]),
    updateGrade: jest.fn().mockImplementation(async (id: string, patch) => ({
      id,
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      response: {},
      is_correct: null,
      confidence: null,
      needs_review: false,
      graded_by: null,
      graded_at: null,
      submitted_at: '2026-09-16T00:00:00.000Z',
      score_awarded: 0,
      ...patch,
    })),
  };
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;

  const service = new QuizEngineService(sessions, questions, teams, answers, broadcast);
  return { service, sessions, questions, teams, answers, broadcast, session };
}

describe('QuizEngineService.transitionState', () => {
  it('rejects an illegal transition without persisting or broadcasting', async () => {
    const { service, sessions, broadcast } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'host1', 'QUESTION_ACTIVE')).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    expect(sessions.updateStatus).not.toHaveBeenCalled();
    expect(broadcast.publish).not.toHaveBeenCalled();
  });

  it('rejects a transition requested by a host who does not own the session', async () => {
    const { service } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'someone-else', 'LOCK_IN_ROUND', { questionId: 'q1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.transitionState('missing', 'host1', 'LOCK_IN_ROUND')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sets question_ends_at from the question time limit on entering QUESTION_ACTIVE', async () => {
    const { service, sessions, broadcast } = buildHarness({
      session: { status: 'LOCK_IN_ROUND', current_question_id: 'q1' },
    });

    const before = Date.now();
    const result = await service.transitionState('s1', 'host1', 'QUESTION_ACTIVE');
    const endsAt = new Date(result.question_ends_at as string).getTime();

    expect(endsAt).toBeGreaterThanOrEqual(before + NUMERIC_QUESTION.time_limit_seconds * 1000);
    expect(sessions.updateStatus).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ status: 'QUESTION_ACTIVE' }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'STATE_CHANGE', expect.any(Object));
  });

  it('grades numeric answers and broadcasts a score update on entering QUESTION_REVEAL', async () => {
    const { service, answers, broadcast } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q1' },
    });
    (answers.listByQuestion as jest.Mock).mockResolvedValue([
      { id: 'a1', team_id: 't1', response: { value: 5.5 } },
      { id: 'a2', team_id: 't2', response: { value: 1 } },
    ]);

    await service.transitionState('s1', 'host1', 'QUESTION_REVEAL');

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ is_correct: true, graded_by: 'AUTO' }),
    );
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a2',
      expect.objectContaining({ is_correct: false, graded_by: 'AUTO' }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', expect.any(Object));
  });

  it('requires a questionId when transitioning into LOCK_IN_ROUND', async () => {
    const { service } = buildHarness({ session: { status: 'LOBBY' } });

    await expect(service.transitionState('s1', 'host1', 'LOCK_IN_ROUND')).rejects.toThrow(
      'questionId is required',
    );
  });
});

describe('QuizEngineService.getState', () => {
  const MC_QUESTION: QuestionRecord = {
    id: 'q-mc',
    quiz_id: 'quiz1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Capital of France?',
    options: [
      { id: 'a', label: 'Paris', isCorrect: true },
      { id: 'b', label: 'Lyon', isCorrect: false },
    ],
    accepted_answers: null,
    correct_numeric: null,
    points: 2,
    time_limit_seconds: 20,
    order_index: 0,
  };

  it('hides the correct option while the question is still active', async () => {
    const { service, sessions, questions } = buildHarness({
      session: { status: 'QUESTION_ACTIVE', current_question_id: 'q-mc' },
    });
    (questions.findById as jest.Mock).mockResolvedValue(MC_QUESTION);
    void sessions;

    const state = await service.getState('s1');

    expect(state.currentQuestion?.options).toEqual([
      { id: 'a', label: 'Paris' },
      { id: 'b', label: 'Lyon' },
    ]);
    expect(state.currentQuestion?.correctOptionId).toBeNull();
  });

  it('reveals the correct option once the session reaches QUESTION_REVEAL', async () => {
    const { service, questions } = buildHarness({
      session: { status: 'QUESTION_REVEAL', current_question_id: 'q-mc' },
    });
    (questions.findById as jest.Mock).mockResolvedValue(MC_QUESTION);

    const state = await service.getState('s1');

    expect(state.currentQuestion?.correctOptionId).toBe('a');
  });

  it('sums each team score from graded answers', async () => {
    const { service, teams, answers } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (answers.listBySession as jest.Mock).mockResolvedValue([
      { team_id: 't1', score_awarded: 2 },
      { team_id: 't1', score_awarded: 1 },
    ]);

    const state = await service.getState('s1');

    expect(state.teams).toEqual([{ id: 't1', name: 'Team A', isActive: true, score: 3, infractionCount: 0 }]);
  });
});

describe('QuizEngineService.resolveDispute', () => {
  it('approves a disputed answer and awards full points', async () => {
    const { service, answers, questions, broadcast } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue({
      id: 'a1',
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      needs_review: true,
    });

    const result = await service.resolveDispute('a1', 'host1', 'APPROVE');

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ is_correct: true, needs_review: false, graded_by: 'HOST', score_awarded: 4 }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', expect.any(Object));
    expect(result.graded_by).toBe('HOST');
    void questions;
  });

  it('rejects a disputed answer and awards zero points', async () => {
    const { service, answers } = buildHarness();
    (answers.findById as jest.Mock).mockResolvedValue({
      id: 'a1',
      session_id: 's1',
      question_id: 'q1',
      team_id: 't1',
      needs_review: true,
    });

    await service.resolveDispute('a1', 'host1', 'REJECT');

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ is_correct: false, score_awarded: 0 }),
    );
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: FAIL with "Cannot find module './quiz-engine.service'"

- [ ] **Step 6: Implement `QuizEngineService`**

`apps/api/src/quiz-engine/quiz-engine.service.ts`:
```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionsRepository } from '../data/questions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { gradeNumericNearest } from './grading/numeric-grader';
import { generateJoinCode } from './join-code';
import { assertValidTransition } from './state-transitions';

export interface TransitionOptions {
  questionId?: string;
}

@Injectable()
export class QuizEngineService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly teams: TeamsRepository,
    private readonly answers: AnswersRepository,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async createSession(quizId: string, hostId: string): Promise<SessionRecord> {
    return this.sessions.create(quizId, hostId, generateJoinCode());
  }

  async getState(sessionId: string): Promise<QuizSessionStateDto> {
    const session = await this.requireSession(sessionId);
    const [question, teams, answers] = await Promise.all([
      session.current_question_id ? this.questions.findById(session.current_question_id) : Promise.resolve(null),
      this.teams.listBySession(sessionId),
      this.answers.listBySession(sessionId),
    ]);

    const scoreByTeam = new Map<string, number>();
    for (const answer of answers) {
      scoreByTeam.set(answer.team_id, (scoreByTeam.get(answer.team_id) ?? 0) + answer.score_awarded);
    }

    const revealSafe = (['QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'] as QuizState[]).includes(session.status);

    return {
      id: session.id,
      joinCode: session.join_code,
      status: session.status,
      currentQuestion: question
        ? {
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            options: question.options ? question.options.map(({ id, label }) => ({ id, label })) : null,
            points: question.points,
            timeLimitSeconds: question.time_limit_seconds,
            orderIndex: question.order_index,
            correctOptionId: revealSafe ? (question.options?.find((o) => o.isCorrect)?.id ?? null) : null,
            correctNumeric: revealSafe ? question.correct_numeric : null,
            acceptedAnswers: revealSafe ? question.accepted_answers : null,
          }
        : null,
      questionEndsAt: session.question_ends_at,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        isActive: team.is_active,
        score: scoreByTeam.get(team.id) ?? 0,
        infractionCount: 0, // wired to real infractions in Task 14
      })),
    };
  }

  async transitionState(
    sessionId: string,
    hostId: string,
    newState: QuizState,
    options: TransitionOptions = {},
  ): Promise<SessionRecord> {
    const session = await this.requireOwnedSession(sessionId, hostId);
    assertValidTransition(session.status, newState);

    const patch: Parameters<SessionsRepository['updateStatus']>[1] = { status: newState };

    if (newState === 'LOCK_IN_ROUND') {
      if (!options.questionId) {
        throw new BadRequestException('questionId is required to start a lock-in round');
      }
      patch.current_question_id = options.questionId;
      if (!session.started_at) {
        patch.started_at = new Date().toISOString();
      }
    }

    if (newState === 'QUESTION_ACTIVE') {
      const questionId = session.current_question_id;
      if (!questionId) throw new BadRequestException('No question selected for this session');
      const question = await this.questions.findById(questionId);
      if (!question) throw new NotFoundException('Question not found');
      patch.question_ends_at = new Date(Date.now() + question.time_limit_seconds * 1000).toISOString();
    }

    if (newState === 'FINISHED') {
      patch.finished_at = new Date().toISOString();
    }

    const updated = await this.sessions.updateStatus(sessionId, patch);

    if (newState === 'QUESTION_REVEAL' && updated.current_question_id) {
      await this.gradeNumericAnswers(updated.id, updated.current_question_id);
    }

    await this.broadcast.publish(sessionId, 'STATE_CHANGE', {
      status: updated.status,
      currentQuestionId: updated.current_question_id,
      questionEndsAt: updated.question_ends_at,
    });

    return updated;
  }

  async resolveDispute(answerId: string, hostId: string, decision: 'APPROVE' | 'REJECT'): Promise<AnswerRecord> {
    const answer = await this.answers.findById(answerId);
    if (!answer) throw new NotFoundException('Answer not found');

    const session = await this.requireOwnedSession(answer.session_id, hostId);
    const question = await this.questions.findById(answer.question_id);
    if (!question) throw new NotFoundException('Question not found');

    const isCorrect = decision === 'APPROVE';
    const updated = await this.answers.updateGrade(answerId, {
      is_correct: isCorrect,
      needs_review: false,
      graded_by: 'HOST',
      score_awarded: isCorrect ? question.points : 0,
    });

    await this.broadcast.publish(session.id, 'SCORE_UPDATE', { teamId: answer.team_id, answerId: updated.id });
    return updated;
  }

  private async gradeNumericAnswers(sessionId: string, questionId: string): Promise<void> {
    const question = await this.questions.findById(questionId);
    if (!question || question.type !== 'NUMERIC_NEAREST' || question.correct_numeric === null) return;

    const submitted = await this.answers.listByQuestion(sessionId, questionId);
    const numericAnswers = submitted.map((a) => ({
      teamId: a.team_id,
      value: Number((a.response as { value: number }).value),
    }));
    const graded = gradeNumericNearest(numericAnswers, question.correct_numeric);
    const winnerCount = graded.filter((g) => g.isCorrect).length || 1;
    const pointsPerWinner = Math.floor(question.points / winnerCount);

    const byTeamId = new Map(submitted.map((a) => [a.team_id, a.id]));
    for (const result of graded) {
      const answerId = byTeamId.get(result.teamId);
      if (!answerId) continue;
      await this.answers.updateGrade(answerId, {
        is_correct: result.isCorrect,
        graded_by: 'AUTO',
        score_awarded: result.isCorrect ? pointsPerWinner : 0,
      });
    }

    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { questionId });
  }

  private async requireSession(sessionId: string): Promise<SessionRecord> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async requireOwnedSession(sessionId: string, hostId: string): Promise<SessionRecord> {
    const session = await this.requireSession(sessionId);
    if (session.host_id !== hostId) throw new ForbiddenException('Not your session');
    return session;
  }
}
```

`apps/api/src/quiz-engine/quiz-engine.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { QuizEngineService } from './quiz-engine.service';

@Module({
  providers: [QuizEngineService],
  exports: [QuizEngineService],
})
export class QuizEngineModule {}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: PASS (all transition, numeric-grading, and dispute-resolution cases)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/quiz-engine apps/api/src/data/answers.repository.ts apps/api/src/data/answers.repository.spec.ts
git commit -m "feat(quiz-engine): add QuizEngineService orchestrating transitions and grading"
```

---

## Task 12: Teams Module — Join Endpoint

**Files:**
- Create: `apps/api/src/teams/dto/join-team.dto.ts`
- Create: `apps/api/src/teams/teams.service.ts`
- Create: `apps/api/src/teams/teams.controller.ts`
- Create: `apps/api/src/teams/teams.module.ts`
- Test: `apps/api/src/teams/teams.service.spec.ts`

**Interfaces:**
- Consumes: `SessionsRepository`, `TeamsRepository` (Task 8), `TeamTokenService`, `hashToken` (Task 9).
- Produces: `POST /sessions/:sessionId/teams/join` returning `{ teamId, name, token }`. `TeamsService.join(sessionId, rawName): Promise<{ teamId: string; name: string; token: string }>` — used directly by `/play`'s join screen (Task 20).

- [ ] **Step 1: Write the failing test**

`apps/api/src/teams/teams.service.spec.ts`:
```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';
import { TeamsService } from './teams.service';

const SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

const TEAM: TeamRecord = {
  id: 't1',
  session_id: 's1',
  name: 'The Quizzards',
  device_token_hash: null,
  joined_at: '2026-09-16T00:00:00.000Z',
  is_active: true,
};

function buildHarness() {
  const sessions = { findById: jest.fn().mockResolvedValue(SESSION) } as unknown as SessionsRepository;
  const teams: TeamsRepository = {
    findById: jest.fn(),
    findBySessionAndName: jest.fn(),
    upsertJoin: jest.fn().mockResolvedValue(TEAM),
    setDeviceTokenHash: jest.fn().mockResolvedValue(TEAM),
    listBySession: jest.fn(),
  };
  const teamTokens = new TeamTokenService(new JwtService({ secret: 'test-secret' }));
  const service = new TeamsService(sessions, teams, teamTokens);
  return { service, sessions, teams, teamTokens };
}

describe('TeamsService.join', () => {
  it('creates the team and returns a token matching the stored hash', async () => {
    const { service, teams, teamTokens } = buildHarness();

    const result = await service.join('s1', 'The Quizzards');

    expect(teams.upsertJoin).toHaveBeenCalledWith('s1', 'The Quizzards');
    expect(result.teamId).toBe('t1');
    expect(result.name).toBe('The Quizzards');
    expect(teamTokens.verify(result.token)).toMatchObject({ sessionId: 's1', teamId: 't1' });
    expect(teams.setDeviceTokenHash).toHaveBeenCalledWith('t1', hashToken(result.token));
  });

  it('rejects a blank team name', async () => {
    const { service } = buildHarness();
    await expect(service.join('s1', '   ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects joining a session that does not exist', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.join('missing', 'Team')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects joining a finished session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue({ ...SESSION, status: 'FINISHED' });

    await expect(service.join('s1', 'Team')).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- teams.service`
Expected: FAIL with "Cannot find module './teams.service'"

- [ ] **Step 3: Implement the DTO, service, controller, and module**

`apps/api/src/teams/dto/join-team.dto.ts`:
```ts
import { IsString, MinLength } from 'class-validator';

export class JoinTeamDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
```

`apps/api/src/teams/teams.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionsRepository } from '../data/sessions.repository';
import { TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';

export interface JoinResult {
  teamId: string;
  name: string;
  token: string;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly teams: TeamsRepository,
    private readonly teamTokens: TeamTokenService,
  ) {}

  async join(sessionId: string, rawName: string): Promise<JoinResult> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'FINISHED') throw new BadRequestException('This quiz has finished');

    const name = rawName.trim();
    if (!name) throw new BadRequestException('Team name is required');

    const team = await this.teams.upsertJoin(sessionId, name);
    const token = this.teamTokens.sign({ sessionId, teamId: team.id });
    await this.teams.setDeviceTokenHash(team.id, hashToken(token));

    return { teamId: team.id, name: team.name, token };
  }
}
```

`apps/api/src/teams/teams.controller.ts`:
```ts
import { Body, Controller, Param, Post } from '@nestjs/common';
import { JoinTeamDto } from './dto/join-team.dto';
import { JoinResult, TeamsService } from './teams.service';

@Controller('sessions/:sessionId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post('join')
  join(@Param('sessionId') sessionId: string, @Body() dto: JoinTeamDto): Promise<JoinResult> {
    return this.teams.join(sessionId, dto.name);
  }
}
```

`apps/api/src/teams/teams.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TeamTokenGuard } from './team-token.guard';
import { TeamTokenService } from './team-token.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow('TEAM_TOKEN_SECRET') }),
    }),
  ],
  controllers: [TeamsController],
  providers: [TeamsService, TeamTokenService, TeamTokenGuard],
  exports: [TeamTokenService, TeamTokenGuard],
})
export class TeamsModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- teams.service`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire `TeamsModule` into the app and commit**

Add `TeamsModule` to `imports` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/teams apps/api/src/app.module.ts
git commit -m "feat(api): add team join endpoint issuing scoped tokens"
```

---

## Task 13: Answers Module — Submit Endpoint

**Files:**
- Create: `apps/api/src/teams/current-team.decorator.ts`
- Create: `apps/api/src/answers/dto/submit-answer.dto.ts`
- Create: `apps/api/src/answers/answers.service.ts`
- Create: `apps/api/src/answers/answers.controller.ts`
- Create: `apps/api/src/answers/answers.module.ts`
- Test: `apps/api/src/answers/answers.service.spec.ts`

**Interfaces:**
- Consumes: `SessionsRepository`, `QuestionsRepository`, `AnswersRepository` (Task 8), `RealtimeBroadcastService` (Task 10), `gradeMultipleChoice`, `gradeFreeText` (Task 7), `TeamTokenGuard`, `TeamTokenPayload` (Task 9), `AnswerSummaryDto` (Task 2).
- Produces: `POST /sessions/:sessionId/answers` (guarded by `TeamTokenGuard`) → `AnswerSummaryDto`. `AnswersService.submit(sessionId, teamId, questionId, response): Promise<AnswerSummaryDto>` — idempotent (same team + question upserts in place), grades `MULTIPLE_CHOICE`/`FREE_TEXT` immediately, leaves `NUMERIC_NEAREST` ungraded for Task 11's `QUESTION_REVEAL` step, and rejects submissions more than 2s past `question_ends_at`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/answers/answers.service.spec.ts`:
```ts
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { AnswersService } from './answers.service';

const ACTIVE_SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  status: 'QUESTION_ACTIVE',
  current_question_id: 'q1',
  question_ends_at: new Date(Date.now() + 10_000).toISOString(),
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: '2026-09-16T00:00:00.000Z',
  finished_at: null,
};

const MC_QUESTION: QuestionRecord = {
  id: 'q1',
  quiz_id: 'quiz1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Capital of France?',
  options: [
    { id: 'a', label: 'Paris', isCorrect: true },
    { id: 'b', label: 'Lyon', isCorrect: false },
  ],
  accepted_answers: null,
  correct_numeric: null,
  points: 3,
  time_limit_seconds: 20,
  order_index: 0,
};

function buildAnswerRecord(overrides?: Partial<AnswerRecord>): AnswerRecord {
  return {
    id: 'ans1',
    session_id: 's1',
    question_id: 'q1',
    team_id: 't1',
    response: { optionId: 'a' },
    is_correct: null,
    confidence: null,
    needs_review: false,
    graded_by: null,
    graded_at: null,
    submitted_at: '2026-09-16T00:00:00.000Z',
    score_awarded: 0,
    ...overrides,
  };
}

function buildHarness(overrides?: { session?: Partial<SessionRecord>; question?: QuestionRecord }) {
  const session = { ...ACTIVE_SESSION, ...overrides?.session };
  const question = overrides?.question ?? MC_QUESTION;

  const sessions = { findById: jest.fn().mockResolvedValue(session) } as unknown as SessionsRepository;
  const questions = { findById: jest.fn().mockResolvedValue(question) } as unknown as QuestionsRepository;
  const answers: AnswersRepository = {
    upsertSubmission: jest.fn().mockImplementation(async (input) => buildAnswerRecord({ response: input.response })),
    findById: jest.fn(),
    listByQuestion: jest.fn(),
    listNeedsReview: jest.fn(),
    listBySession: jest.fn(),
    updateGrade: jest.fn().mockImplementation(async (id: string, patch) => buildAnswerRecord({ id, ...patch })),
  };
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;

  const service = new AnswersService(sessions, questions, answers, broadcast);
  return { service, sessions, questions, answers, broadcast };
}

describe('AnswersService.submit', () => {
  it('auto-grades a correct multiple-choice answer immediately', async () => {
    const { service, answers, broadcast } = buildHarness();

    const result = await service.submit('s1', 't1', 'q1', { optionId: 'a' });

    expect(answers.upsertSubmission).toHaveBeenCalledWith({
      sessionId: 's1',
      questionId: 'q1',
      teamId: 't1',
      response: { optionId: 'a' },
    });
    expect(answers.updateGrade).toHaveBeenCalledWith(
      'ans1',
      expect.objectContaining({ is_correct: true, graded_by: 'AUTO', score_awarded: 3 }),
    );
    expect(result.isCorrect).toBe(true);
    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'SCORE_UPDATE', { teamId: 't1' });
  });

  it('auto-grades an incorrect multiple-choice answer as zero points', async () => {
    const { service, answers } = buildHarness();

    await service.submit('s1', 't1', 'q1', { optionId: 'b' });

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'ans1',
      expect.objectContaining({ is_correct: false, score_awarded: 0 }),
    );
  });

  it('sends a low-confidence free-text answer to the dispute queue instead of auto-grading', async () => {
    const freeTextQuestion: QuestionRecord = {
      ...MC_QUESTION,
      type: 'FREE_TEXT',
      options: null,
      accepted_answers: ['Paris'],
    };
    const { service, answers } = buildHarness({ question: freeTextQuestion });

    await service.submit('s1', 't1', 'q1', { text: 'Pahhris' });

    expect(answers.updateGrade).toHaveBeenCalledWith(
      'ans1',
      expect.objectContaining({ needs_review: true, is_correct: null, graded_by: null }),
    );
  });

  it('leaves a numeric answer ungraded until reveal', async () => {
    const numericQuestion: QuestionRecord = {
      ...MC_QUESTION,
      type: 'NUMERIC_NEAREST',
      options: null,
      correct_numeric: 5.4,
    };
    const { service, answers } = buildHarness({ question: numericQuestion });

    await service.submit('s1', 't1', 'q1', { value: 5 });

    expect(answers.updateGrade).not.toHaveBeenCalled();
  });

  it('rejects a submission for a question that is not the active one', async () => {
    const { service } = buildHarness({ session: { current_question_id: 'some-other-question' } });

    await expect(service.submit('s1', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a submission after the grace window has closed', async () => {
    const { service } = buildHarness({ session: { question_ends_at: new Date(Date.now() - 10_000).toISOString() } });

    await expect(service.submit('s1', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects a submission for an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.submit('missing', 't1', 'q1', { optionId: 'a' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- answers.service`
Expected: FAIL with "Cannot find module './answers.service'"

- [ ] **Step 3: Implement the decorator, DTO, service, controller, and module**

`apps/api/src/teams/current-team.decorator.ts`:
```ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { TeamTokenPayload } from './team-token.service';

export const CurrentTeam = createParamDecorator((_data: unknown, ctx: ExecutionContext): TeamTokenPayload => {
  return ctx.switchToHttp().getRequest().team;
});
```

`apps/api/src/answers/dto/submit-answer.dto.ts`:
```ts
import { IsObject, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  questionId!: string;

  @IsObject()
  response!: { optionId?: string; text?: string; value?: number };
}
```

`apps/api/src/answers/answers.service.ts`:
```ts
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AnswerSummaryDto } from '@quizicius/shared-types';
import { AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { gradeFreeText } from '../quiz-engine/grading/free-text-grader';
import { gradeMultipleChoice } from '../quiz-engine/grading/multiple-choice-grader';

const LATE_SUBMISSION_GRACE_MS = 2000;

export interface SubmitResponseInput {
  optionId?: string;
  text?: string;
  value?: number;
}

@Injectable()
export class AnswersService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly answers: AnswersRepository,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async submit(
    sessionId: string,
    teamId: string,
    questionId: string,
    response: SubmitResponseInput,
  ): Promise<AnswerSummaryDto> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'QUESTION_ACTIVE' || session.current_question_id !== questionId) {
      throw new BadRequestException('This question is not currently active');
    }
    if (session.question_ends_at) {
      const deadline = new Date(session.question_ends_at).getTime() + LATE_SUBMISSION_GRACE_MS;
      if (Date.now() > deadline) {
        throw new UnprocessableEntityException('Submission window has closed');
      }
    }

    const question = await this.questions.findById(questionId);
    if (!question) throw new NotFoundException('Question not found');

    const saved = await this.answers.upsertSubmission({ sessionId, questionId, teamId, response });
    const graded = await this.gradeImmediately(question, saved);

    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { teamId });
    return this.toSummary(graded);
  }

  private async gradeImmediately(question: QuestionRecord, answer: AnswerRecord): Promise<AnswerRecord> {
    if (question.type === 'MULTIPLE_CHOICE') {
      const selectedOptionId = (answer.response as SubmitResponseInput).optionId ?? '';
      const correctOptionId = question.options?.find((o) => o.isCorrect)?.id ?? '';
      const isCorrect = gradeMultipleChoice(selectedOptionId, correctOptionId);
      return this.answers.updateGrade(answer.id, {
        is_correct: isCorrect,
        graded_by: 'AUTO',
        score_awarded: isCorrect ? question.points : 0,
      });
    }

    if (question.type === 'FREE_TEXT') {
      const text = (answer.response as SubmitResponseInput).text ?? '';
      const result = gradeFreeText(text, question.accepted_answers ?? []);
      return this.answers.updateGrade(answer.id, {
        is_correct: result.isCorrect,
        confidence: result.confidence,
        needs_review: result.needsReview,
        graded_by: result.needsReview ? null : 'AUTO',
        score_awarded: result.isCorrect ? question.points : 0,
      });
    }

    // NUMERIC_NEAREST is graded once the round closes (QuizEngineService, on QUESTION_REVEAL).
    return answer;
  }

  private toSummary(answer: AnswerRecord): AnswerSummaryDto {
    return {
      id: answer.id,
      sessionId: answer.session_id,
      questionId: answer.question_id,
      teamId: answer.team_id,
      response: answer.response,
      isCorrect: answer.is_correct,
      confidence: answer.confidence,
      needsReview: answer.needs_review,
      gradedBy: answer.graded_by,
      scoreAwarded: answer.score_awarded,
    };
  }
}
```

`apps/api/src/answers/answers.controller.ts`:
```ts
import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { AnswerSummaryDto } from '@quizicius/shared-types';
import { CurrentTeam } from '../teams/current-team.decorator';
import { TeamTokenGuard } from '../teams/team-token.guard';
import { TeamTokenPayload } from '../teams/team-token.service';
import { AnswersService } from './answers.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Controller('sessions/:sessionId/answers')
@UseGuards(TeamTokenGuard)
export class AnswersController {
  constructor(private readonly answers: AnswersService) {}

  @Post()
  submit(
    @Param('sessionId') sessionId: string,
    @CurrentTeam() team: TeamTokenPayload,
    @Body() dto: SubmitAnswerDto,
  ): Promise<AnswerSummaryDto> {
    if (team.sessionId !== sessionId) {
      throw new ForbiddenException('Token does not match this session');
    }
    return this.answers.submit(sessionId, team.teamId, dto.questionId, dto.response);
  }
}
```

`apps/api/src/answers/answers.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';

@Module({
  imports: [TeamsModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- answers.service`
Expected: PASS (7 tests)

- [ ] **Step 5: Wire `AnswersModule` into the app and commit**

Add `AnswersModule` to `imports` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/teams/current-team.decorator.ts apps/api/src/answers apps/api/src/app.module.ts
git commit -m "feat(api): add idempotent answer submission with immediate MC/free-text grading"
```

---

## Task 14: Infractions Module

**Files:**
- Create: `apps/api/src/data/infractions.repository.ts`
- Test: `apps/api/src/data/infractions.repository.spec.ts`
- Modify: `apps/api/src/data/data.module.ts` (register `InfractionsRepository`)
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.ts` (inject `InfractionsRepository`, wire real infraction counts into `getState`)
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.spec.ts` (update harness, add a coverage test)
- Create: `apps/api/src/infractions/dto/report-infraction.dto.ts`
- Create: `apps/api/src/infractions/infractions.service.ts`
- Create: `apps/api/src/infractions/infractions.controller.ts`
- Create: `apps/api/src/infractions/infractions.module.ts`
- Test: `apps/api/src/infractions/infractions.service.spec.ts`

**Interfaces:**
- Consumes: `SupabaseService` (Task 4), `SessionsRepository` (Task 8), `TeamTokenGuard`/`CurrentTeam` (Tasks 9, 13), `SupabaseAuthGuard`/`CurrentHost` (Task 5), `INFRACTION_TYPES` (Task 2).
- Produces: `InfractionsRepository.create(sessionId, teamId, type): Promise<InfractionRecord>`, `InfractionsRepository.listBySession(sessionId): Promise<InfractionRecord[]>`; `POST /api/infractions/report` (team-token guarded, matches the exact path the original spec's `useQuizSecurity` hook calls — Task 17); `GET /sessions/:sessionId/infractions` (host-only, feeds the dispute queue — Task 18).

- [ ] **Step 1: Write the failing repository test**

`apps/api/src/data/infractions.repository.spec.ts`:
```ts
import { InfractionType } from '@quizicius/shared-types';
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { InfractionRecord, SupabaseInfractionsRepository } from './infractions.repository';

const RECORD: InfractionRecord = {
  id: 'inf1',
  session_id: 's1',
  team_id: 't1',
  type: 'VISIBILITY_HIDDEN' as InfractionType,
  detected_at: '2026-09-16T00:00:00.000Z',
  reviewed: false,
};

describe('SupabaseInfractionsRepository', () => {
  it('creates an infraction record', async () => {
    const supabase = fakeSupabaseService({ infractions: { data: RECORD, error: null } });
    const repo = new SupabaseInfractionsRepository(supabase);

    await expect(repo.create('s1', 't1', 'VISIBILITY_HIDDEN')).resolves.toEqual(RECORD);
  });

  it('lists infractions for a session', async () => {
    const supabase = fakeSupabaseService({ infractions: { data: [RECORD], error: null } });
    const repo = new SupabaseInfractionsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then implement the repository**

Run: `pnpm --filter api test -- infractions.repository`
Expected: FAIL with "Cannot find module './infractions.repository'"

`apps/api/src/data/infractions.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InfractionType } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface InfractionRecord {
  id: string;
  session_id: string;
  team_id: string;
  type: InfractionType;
  detected_at: string;
  reviewed: boolean;
}

export abstract class InfractionsRepository {
  abstract create(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord>;
  abstract listBySession(sessionId: string): Promise<InfractionRecord[]>;
}

@Injectable()
export class SupabaseInfractionsRepository extends InfractionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .insert({ session_id: sessionId, team_id: teamId, type })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as InfractionRecord;
  }

  async listBySession(sessionId: string): Promise<InfractionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('infractions')
      .select()
      .eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as InfractionRecord[];
  }
}
```

Update `apps/api/src/data/data.module.ts` to register it:
```ts
import { Global, Module } from '@nestjs/common';
import { AnswersRepository, SupabaseAnswersRepository } from './answers.repository';
import { InfractionsRepository, SupabaseInfractionsRepository } from './infractions.repository';
import { QuestionsRepository, SupabaseQuestionsRepository } from './questions.repository';
import { SessionsRepository, SupabaseSessionsRepository } from './sessions.repository';
import { SupabaseTeamsRepository, TeamsRepository } from './teams.repository';

@Global()
@Module({
  providers: [
    { provide: SessionsRepository, useClass: SupabaseSessionsRepository },
    { provide: QuestionsRepository, useClass: SupabaseQuestionsRepository },
    { provide: TeamsRepository, useClass: SupabaseTeamsRepository },
    { provide: AnswersRepository, useClass: SupabaseAnswersRepository },
    { provide: InfractionsRepository, useClass: SupabaseInfractionsRepository },
  ],
  exports: [SessionsRepository, QuestionsRepository, TeamsRepository, AnswersRepository, InfractionsRepository],
})
export class DataModule {}
```

Run: `pnpm --filter api test -- infractions.repository`
Expected: PASS

- [ ] **Step 3: Wire real infraction counts into `QuizEngineService.getState`**

In `apps/api/src/quiz-engine/quiz-engine.service.spec.ts`, add `InfractionsRepository` to imports and to `buildHarness`:
```ts
import { InfractionsRepository } from '../data/infractions.repository';
```
```ts
  const infractions: InfractionsRepository = {
    create: jest.fn(),
    listBySession: jest.fn().mockResolvedValue([]),
  };
```
Pass `infractions` as the new final constructor argument: `new QuizEngineService(sessions, questions, teams, answers, infractions, broadcast)`, and include it in the harness's returned object.

Add a new test to the `QuizEngineService.getState` describe block:
```ts
  it('includes each team infraction count from InfractionsRepository', async () => {
    const { service, teams, infractions } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (infractions.listBySession as jest.Mock).mockResolvedValue([
      { id: 'i1', session_id: 's1', team_id: 't1', type: 'VISIBILITY_HIDDEN', detected_at: 'now', reviewed: false },
      { id: 'i2', session_id: 's1', team_id: 't1', type: 'FULLSCREEN_EXIT', detected_at: 'now', reviewed: false },
    ]);

    const state = await service.getState('s1');

    expect(state.teams[0].infractionCount).toBe(2);
  });
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: FAIL (constructor arity mismatch / `infractionCount` still hardcoded to 0)

In `apps/api/src/quiz-engine/quiz-engine.service.ts`, add the import and constructor parameter:
```ts
import { InfractionsRepository } from '../data/infractions.repository';
```
```ts
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly questions: QuestionsRepository,
    private readonly teams: TeamsRepository,
    private readonly answers: AnswersRepository,
    private readonly infractions: InfractionsRepository,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}
```

Replace the `getState` body's team-fetching and mapping to compute real counts:
```ts
    const [question, teams, answers, infractions] = await Promise.all([
      session.current_question_id ? this.questions.findById(session.current_question_id) : Promise.resolve(null),
      this.teams.listBySession(sessionId),
      this.answers.listBySession(sessionId),
      this.infractions.listBySession(sessionId),
    ]);

    const scoreByTeam = new Map<string, number>();
    for (const answer of answers) {
      scoreByTeam.set(answer.team_id, (scoreByTeam.get(answer.team_id) ?? 0) + answer.score_awarded);
    }

    const infractionCountByTeam = new Map<string, number>();
    for (const infraction of infractions) {
      infractionCountByTeam.set(infraction.team_id, (infractionCountByTeam.get(infraction.team_id) ?? 0) + 1);
    }
```
And in the `teams.map(...)` block, replace `infractionCount: 0, // wired to real infractions in Task 14` with:
```ts
        infractionCount: infractionCountByTeam.get(team.id) ?? 0,
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: PASS (all prior tests plus the new infraction-count test)

- [ ] **Step 4: Write the failing `InfractionsService` test**

`apps/api/src/infractions/infractions.service.spec.ts`:
```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InfractionsRepository } from '../data/infractions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { InfractionsService } from './infractions.service';

const SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  status: 'QUESTION_ACTIVE',
  current_question_id: 'q1',
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: '2026-09-16T00:00:00.000Z',
  finished_at: null,
};

function buildHarness() {
  const sessions = { findById: jest.fn().mockResolvedValue(SESSION) } as unknown as SessionsRepository;
  const infractions: InfractionsRepository = {
    create: jest.fn().mockResolvedValue({
      id: 'inf1',
      session_id: 's1',
      team_id: 't1',
      type: 'VISIBILITY_HIDDEN',
      detected_at: '2026-09-16T00:00:00.000Z',
      reviewed: false,
    }),
    listBySession: jest.fn().mockResolvedValue([]),
  };
  const service = new InfractionsService(sessions, infractions);
  return { service, sessions, infractions };
}

describe('InfractionsService.report', () => {
  it('records an infraction for the reporting team', async () => {
    const { service, infractions } = buildHarness();

    await service.report('s1', 't1', 'VISIBILITY_HIDDEN');

    expect(infractions.create).toHaveBeenCalledWith('s1', 't1', 'VISIBILITY_HIDDEN');
  });

  it('rejects reporting against an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.report('missing', 't1', 'VISIBILITY_HIDDEN')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InfractionsService.listForHost', () => {
  it('returns the infraction list for the owning host', async () => {
    const { service, infractions } = buildHarness();

    await service.listForHost('s1', 'host1');

    expect(infractions.listBySession).toHaveBeenCalledWith('s1');
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.listForHost('s1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter api test -- infractions.service`
Expected: FAIL with "Cannot find module './infractions.service'"

- [ ] **Step 6: Implement the DTO, service, controller, and module**

`apps/api/src/infractions/dto/report-infraction.dto.ts`:
```ts
import { IsIn } from 'class-validator';
import { INFRACTION_TYPES, InfractionType } from '@quizicius/shared-types';

export class ReportInfractionDto {
  @IsIn(INFRACTION_TYPES)
  type!: InfractionType;
}
```

`apps/api/src/infractions/infractions.service.ts`:
```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InfractionType } from '@quizicius/shared-types';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { SessionsRepository } from '../data/sessions.repository';

@Injectable()
export class InfractionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly infractions: InfractionsRepository,
  ) {}

  async report(sessionId: string, teamId: string, type: InfractionType): Promise<InfractionRecord> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return this.infractions.create(sessionId, teamId, type);
  }

  async listForHost(sessionId: string, hostId: string): Promise<InfractionRecord[]> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.host_id !== hostId) throw new ForbiddenException('Not your session');
    return this.infractions.listBySession(sessionId);
  }
}
```

`apps/api/src/infractions/infractions.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentTeam } from '../teams/current-team.decorator';
import { TeamTokenGuard } from '../teams/team-token.guard';
import { TeamTokenPayload } from '../teams/team-token.service';
import { ReportInfractionDto } from './dto/report-infraction.dto';
import { InfractionsService } from './infractions.service';

@Controller()
export class InfractionsController {
  constructor(private readonly infractions: InfractionsService) {}

  @Post('api/infractions/report')
  @UseGuards(TeamTokenGuard)
  report(@CurrentTeam() team: TeamTokenPayload, @Body() dto: ReportInfractionDto) {
    return this.infractions.report(team.sessionId, team.teamId, dto.type);
  }

  @Get('sessions/:sessionId/infractions')
  @UseGuards(SupabaseAuthGuard)
  list(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.infractions.listForHost(sessionId, host.id);
  }
}
```

`apps/api/src/infractions/infractions.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';

@Module({
  imports: [AuthModule, TeamsModule],
  controllers: [InfractionsController],
  providers: [InfractionsService],
})
export class InfractionsModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter api test -- infractions.service`
Expected: PASS (4 tests)

- [ ] **Step 8: Wire `InfractionsModule` into the app and commit**

Add `InfractionsModule` to `imports` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/data/infractions.repository.ts apps/api/src/data/infractions.repository.spec.ts apps/api/src/data/data.module.ts apps/api/src/quiz-engine/quiz-engine.service.ts apps/api/src/quiz-engine/quiz-engine.service.spec.ts apps/api/src/infractions apps/api/src/app.module.ts
git commit -m "feat(api): add infraction reporting and host-facing dispute queue counts"
```

---

## Task 15: Quizzes/Questions/Sessions Controllers + Full-Lifecycle Integration Test

**Files:**
- Create: `apps/api/src/data/quizzes.repository.ts`
- Test: `apps/api/src/data/quizzes.repository.spec.ts`
- Modify: `apps/api/src/data/data.module.ts` (register `QuizzesRepository`)
- Create: `apps/api/src/quizzes/dto/create-quiz.dto.ts`
- Create: `apps/api/src/quizzes/quizzes.controller.ts`
- Create: `apps/api/src/quizzes/quizzes.module.ts`
- Create: `apps/api/src/questions/dto/create-question.dto.ts`
- Create: `apps/api/src/questions/questions.controller.ts`
- Create: `apps/api/src/questions/questions.module.ts`
- Create: `apps/api/src/sessions/dto/transition-session.dto.ts`
- Create: `apps/api/src/sessions/dto/resolve-dispute.dto.ts`
- Create: `apps/api/src/sessions/sessions.controller.ts`
- Create: `apps/api/src/sessions/sessions.module.ts`
- Create: `apps/api/src/quiz-engine/invalid-transition.filter.ts`
- Modify: `apps/api/src/main.ts` (global `ValidationPipe` + `InvalidTransitionExceptionFilter`)
- Modify: `apps/api/src/app.module.ts` (wire all remaining modules)
- Create: `apps/api/src/test-utils/in-memory-repositories.ts`
- Test: `apps/api/src/session-lifecycle.integration.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–14.
- Produces: `POST /quizzes`, `GET /quizzes` (host-only); `POST /quizzes/:quizId/questions`, `GET /quizzes/:quizId/questions` (host-only); `POST /quizzes/:quizId/sessions` (host-only, creates a session); `GET /sessions/:sessionId/state` (public rehydration); `POST /sessions/:sessionId/transition` (host-only); `POST /answers/:answerId/resolve-dispute` (host-only). `QuizzesRepository.create(hostId, title): Promise<QuizRecord>`, `.findById(id): Promise<QuizRecord | null>`, `.listByHost(hostId): Promise<QuizRecord[]>` — consumed by the frontend API client (Task 16).

- [ ] **Step 1: Write the failing `QuizzesRepository` test, then implement it**

`apps/api/src/data/quizzes.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { QuizRecord, SupabaseQuizzesRepository } from './quizzes.repository';

const RECORD: QuizRecord = {
  id: 'quiz1',
  host_id: 'host1',
  league_id: null,
  title: 'Wednesday Night Quiz',
  created_at: '2026-09-16T00:00:00.000Z',
};

describe('SupabaseQuizzesRepository', () => {
  it('creates a quiz owned by the host', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: RECORD, error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.create('host1', 'Wednesday Night Quiz')).resolves.toEqual(RECORD);
  });

  it('lists quizzes for a host', async () => {
    const supabase = fakeSupabaseService({ quizzes: { data: [RECORD], error: null } });
    const repo = new SupabaseQuizzesRepository(supabase);

    await expect(repo.listByHost('host1')).resolves.toEqual([RECORD]);
  });
});
```

Run: `pnpm --filter api test -- quizzes.repository`
Expected: FAIL, then implement:

`apps/api/src/data/quizzes.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuizRecord {
  id: string;
  host_id: string;
  league_id: string | null;
  title: string;
  created_at: string;
}

export abstract class QuizzesRepository {
  abstract create(hostId: string, title: string): Promise<QuizRecord>;
  abstract findById(id: string): Promise<QuizRecord | null>;
  abstract listByHost(hostId: string): Promise<QuizRecord[]>;
}

@Injectable()
export class SupabaseQuizzesRepository extends QuizzesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(hostId: string, title: string): Promise<QuizRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quizzes')
      .insert({ host_id: hostId, title })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuizRecord;
  }

  async findById(id: string): Promise<QuizRecord | null> {
    const { data, error } = await this.supabase.getClient().from('quizzes').select().eq('id', id).single();
    if (error) return null;
    return data as QuizRecord;
  }

  async listByHost(hostId: string): Promise<QuizRecord[]> {
    const { data, error } = await this.supabase.getClient().from('quizzes').select().eq('host_id', hostId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as QuizRecord[];
  }
}
```

Update `apps/api/src/data/data.module.ts` to also provide and export `QuizzesRepository` (`{ provide: QuizzesRepository, useClass: SupabaseQuizzesRepository }`), following the same pattern as the other four repositories.

Run: `pnpm --filter api test -- quizzes.repository`
Expected: PASS

- [ ] **Step 2: Add the DTOs**

`apps/api/src/quizzes/dto/create-quiz.dto.ts`:
```ts
import { IsString, MinLength } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @MinLength(1)
  title!: string;
}
```

`apps/api/src/questions/dto/create-question.dto.ts`:
```ts
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '@quizicius/shared-types';

export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @IsString()
  prompt!: string;

  @IsOptional()
  @IsArray()
  options?: { id: string; label: string; isCorrect: boolean }[];

  @IsOptional()
  @IsArray()
  acceptedAnswers?: string[];

  @IsOptional()
  @IsNumber()
  correctNumeric?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitSeconds?: number;

  @IsInt()
  @Min(0)
  orderIndex!: number;
}
```

`apps/api/src/sessions/dto/transition-session.dto.ts`:
```ts
import { IsIn, IsOptional, IsString } from 'class-validator';
import { QUIZ_STATES, QuizState } from '@quizicius/shared-types';

export class TransitionSessionDto {
  @IsIn(QUIZ_STATES)
  status!: QuizState;

  @IsOptional()
  @IsString()
  questionId?: string;
}
```

`apps/api/src/sessions/dto/resolve-dispute.dto.ts`:
```ts
import { IsIn } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
}
```

- [ ] **Step 3: Add the controllers and modules**

`apps/api/src/quizzes/quizzes.controller.ts`:
```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizzesRepository } from '../data/quizzes.repository';
import { CreateQuizDto } from './dto/create-quiz.dto';

@Controller('quizzes')
@UseGuards(SupabaseAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesRepository) {}

  @Post()
  create(@CurrentHost() host: CurrentHostPayload, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(host.id, dto.title);
  }

  @Get()
  list(@CurrentHost() host: CurrentHostPayload) {
    return this.quizzes.listByHost(host.id);
  }
}
```

`apps/api/src/quizzes/quizzes.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizzesController } from './quizzes.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuizzesController],
})
export class QuizzesModule {}
```

`apps/api/src/questions/questions.controller.ts`:
```ts
import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuestionsRepository } from '../data/questions.repository';
import { QuizzesRepository } from '../data/quizzes.repository';
import { CreateQuestionDto } from './dto/create-question.dto';

@Controller('quizzes/:quizId/questions')
@UseGuards(SupabaseAuthGuard)
export class QuestionsController {
  constructor(
    private readonly quizzes: QuizzesRepository,
    private readonly questions: QuestionsRepository,
  ) {}

  @Post()
  async create(
    @Param('quizId') quizId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: CreateQuestionDto,
  ) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.create(quizId, {
      type: dto.type,
      prompt: dto.prompt,
      options: dto.options ?? null,
      accepted_answers: dto.acceptedAnswers ?? null,
      correct_numeric: dto.correctNumeric ?? null,
      points: dto.points ?? 1,
      time_limit_seconds: dto.timeLimitSeconds ?? 30,
      order_index: dto.orderIndex,
    });
  }

  @Get()
  async list(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    await this.requireOwnedQuiz(quizId, host.id);
    return this.questions.listByQuiz(quizId);
  }

  private async requireOwnedQuiz(quizId: string, hostId: string): Promise<void> {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== hostId) throw new ForbiddenException('Not your quiz');
  }
}
```

`apps/api/src/questions/questions.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionsController } from './questions.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuestionsController],
})
export class QuestionsModule {}
```

`apps/api/src/quiz-engine/invalid-transition.filter.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { InvalidTransitionError } from './state-transitions';

interface MinimalResponse {
  status: (code: number) => { json: (body: unknown) => void };
}

@Catch(InvalidTransitionError)
export class InvalidTransitionExceptionFilter implements ExceptionFilter {
  catch(exception: InvalidTransitionError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<MinimalResponse>();
    response.status(409).json({
      statusCode: 409,
      message: exception.message,
      currentState: exception.from,
    });
  }
}
```

`apps/api/src/sessions/sessions.controller.ts`:
```ts
import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizzesRepository } from '../data/quizzes.repository';
import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { TransitionSessionDto } from './dto/transition-session.dto';

@Controller()
export class SessionsController {
  constructor(
    private readonly quizEngine: QuizEngineService,
    private readonly quizzes: QuizzesRepository,
  ) {}

  @Post('quizzes/:quizId/sessions')
  @UseGuards(SupabaseAuthGuard)
  async create(@Param('quizId') quizId: string, @CurrentHost() host: CurrentHostPayload) {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.host_id !== host.id) throw new ForbiddenException('Not your quiz');
    return this.quizEngine.createSession(quizId, host.id);
  }

  @Get('sessions/:sessionId/state')
  getState(@Param('sessionId') sessionId: string) {
    return this.quizEngine.getState(sessionId);
  }

  @Post('sessions/:sessionId/transition')
  @UseGuards(SupabaseAuthGuard)
  transition(
    @Param('sessionId') sessionId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: TransitionSessionDto,
  ) {
    return this.quizEngine.transitionState(sessionId, host.id, dto.status, { questionId: dto.questionId });
  }

  @Post('answers/:answerId/resolve-dispute')
  @UseGuards(SupabaseAuthGuard)
  resolveDispute(
    @Param('answerId') answerId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.quizEngine.resolveDispute(answerId, host.id, dto.decision);
  }
}
```

`apps/api/src/sessions/sessions.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizEngineModule } from '../quiz-engine/quiz-engine.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [AuthModule, QuizEngineModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
```

Update `apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InvalidTransitionExceptionFilter } from './quiz-engine/invalid-transition.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new InvalidTransitionExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

Update `apps/api/src/app.module.ts` to import every feature module built so far:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnswersModule } from './answers/answers.module';
import { validateEnv } from './config/env.validation';
import { DataModule } from './data/data.module';
import { InfractionsModule } from './infractions/infractions.module';
import { QuestionsModule } from './questions/questions.module';
import { QuizEngineModule } from './quiz-engine/quiz-engine.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SessionsModule } from './sessions/sessions.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    DataModule,
    RealtimeModule,
    QuizEngineModule,
    TeamsModule,
    AnswersModule,
    InfractionsModule,
    QuizzesModule,
    QuestionsModule,
    SessionsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Write the in-memory repository test doubles**

`apps/api/src/test-utils/in-memory-repositories.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { AnswerGradePatch, AnswerRecord, AnswersRepository } from '../data/answers.repository';
import { InfractionRecord, InfractionsRepository } from '../data/infractions.repository';
import { QuestionRecord, QuestionsRepository } from '../data/questions.repository';
import { QuizRecord, QuizzesRepository } from '../data/quizzes.repository';
import { SessionRecord, SessionsRepository, SessionStatusPatch } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';

export class InMemorySessionsRepository extends SessionsRepository {
  private rows = new Map<string, SessionRecord>();

  async create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      quiz_id: quizId,
      host_id: hostId,
      join_code: joinCode,
      status: 'LOBBY',
      current_question_id: null,
      question_ends_at: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('session not found');
    const updated = { ...existing, ...patch };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryQuestionsRepository extends QuestionsRepository {
  private rows = new Map<string, QuestionRecord>();

  async findById(id: string): Promise<QuestionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByQuiz(quizId: string): Promise<QuestionRecord[]> {
    return [...this.rows.values()]
      .filter((q) => q.quiz_id === quizId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  async create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord> {
    const record: QuestionRecord = { id: randomUUID(), quiz_id: quizId, ...input };
    this.rows.set(record.id, record);
    return record;
  }
}

export class InMemoryTeamsRepository extends TeamsRepository {
  private rows = new Map<string, TeamRecord>();

  async findById(teamId: string): Promise<TeamRecord | null> {
    return this.rows.get(teamId) ?? null;
  }

  async findBySessionAndName(sessionId: string, name: string): Promise<TeamRecord | null> {
    return [...this.rows.values()].find((t) => t.session_id === sessionId && t.name === name) ?? null;
  }

  async upsertJoin(sessionId: string, name: string): Promise<TeamRecord> {
    const existing = await this.findBySessionAndName(sessionId, name);
    if (existing) {
      const updated = { ...existing, is_active: true, joined_at: new Date().toISOString() };
      this.rows.set(updated.id, updated);
      return updated;
    }
    const record: TeamRecord = {
      id: randomUUID(),
      session_id: sessionId,
      name,
      device_token_hash: null,
      joined_at: new Date().toISOString(),
      is_active: true,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async setDeviceTokenHash(teamId: string, tokenHash: string): Promise<TeamRecord> {
    const existing = this.rows.get(teamId);
    if (!existing) throw new Error('team not found');
    const updated = { ...existing, device_token_hash: tokenHash };
    this.rows.set(teamId, updated);
    return updated;
  }

  async listBySession(sessionId: string): Promise<TeamRecord[]> {
    return [...this.rows.values()].filter((t) => t.session_id === sessionId);
  }
}

export class InMemoryAnswersRepository extends AnswersRepository {
  private rows = new Map<string, AnswerRecord>();

  async upsertSubmission(input: {
    sessionId: string;
    questionId: string;
    teamId: string;
    response: unknown;
  }): Promise<AnswerRecord> {
    const existing = [...this.rows.values()].find(
      (a) => a.session_id === input.sessionId && a.question_id === input.questionId && a.team_id === input.teamId,
    );
    if (existing) {
      const updated = { ...existing, response: input.response, submitted_at: new Date().toISOString() };
      this.rows.set(updated.id, updated);
      return updated;
    }
    const record: AnswerRecord = {
      id: randomUUID(),
      session_id: input.sessionId,
      question_id: input.questionId,
      team_id: input.teamId,
      response: input.response,
      is_correct: null,
      confidence: null,
      needs_review: false,
      graded_by: null,
      graded_at: null,
      submitted_at: new Date().toISOString(),
      score_awarded: 0,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<AnswerRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId && a.question_id === questionId);
  }

  async listNeedsReview(sessionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId && a.needs_review);
  }

  async listBySession(sessionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()].filter((a) => a.session_id === sessionId);
  }

  async updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('answer not found');
    const updated = { ...existing, ...patch, graded_at: patch.graded_at ?? new Date().toISOString() };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryInfractionsRepository extends InfractionsRepository {
  private rows: InfractionRecord[] = [];

  async create(sessionId: string, teamId: string, type: InfractionRecord['type']): Promise<InfractionRecord> {
    const record: InfractionRecord = {
      id: randomUUID(),
      session_id: sessionId,
      team_id: teamId,
      type,
      detected_at: new Date().toISOString(),
      reviewed: false,
    };
    this.rows.push(record);
    return record;
  }

  async listBySession(sessionId: string): Promise<InfractionRecord[]> {
    return this.rows.filter((i) => i.session_id === sessionId);
  }
}

export class InMemoryQuizzesRepository extends QuizzesRepository {
  private rows = new Map<string, QuizRecord>();

  async create(hostId: string, title: string): Promise<QuizRecord> {
    const record: QuizRecord = {
      id: randomUUID(),
      host_id: hostId,
      league_id: null,
      title,
      created_at: new Date().toISOString(),
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<QuizRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listByHost(hostId: string): Promise<QuizRecord[]> {
    return [...this.rows.values()].filter((q) => q.host_id === hostId);
  }
}
```

- [ ] **Step 5: Write the failing integration test**

`apps/api/src/session-lifecycle.integration.spec.ts`:
```ts
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { AnswersRepository } from './data/answers.repository';
import { InfractionsRepository } from './data/infractions.repository';
import { QuestionsRepository } from './data/questions.repository';
import { QuizzesRepository } from './data/quizzes.repository';
import { SessionsRepository } from './data/sessions.repository';
import { TeamsRepository } from './data/teams.repository';
import { InvalidTransitionExceptionFilter } from './quiz-engine/invalid-transition.filter';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import {
  InMemoryAnswersRepository,
  InMemoryInfractionsRepository,
  InMemoryQuestionsRepository,
  InMemoryQuizzesRepository,
  InMemorySessionsRepository,
  InMemoryTeamsRepository,
} from './test-utils/in-memory-repositories';

describe('Session lifecycle (integration)', () => {
  let app: INestApplication;
  let quizId: string;
  let questionId: string;

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TEAM_TOKEN_SECRET = 'integration-test-secret';

    const quizzesRepo = new InMemoryQuizzesRepository();
    const questionsRepo = new InMemoryQuestionsRepository();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SessionsRepository)
      .useValue(new InMemorySessionsRepository())
      .overrideProvider(QuestionsRepository)
      .useValue(questionsRepo)
      .overrideProvider(TeamsRepository)
      .useValue(new InMemoryTeamsRepository())
      .overrideProvider(AnswersRepository)
      .useValue(new InMemoryAnswersRepository())
      .overrideProvider(InfractionsRepository)
      .useValue(new InMemoryInfractionsRepository())
      .overrideProvider(QuizzesRepository)
      .useValue(quizzesRepo)
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().host = { id: 'host1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new InvalidTransitionExceptionFilter());
    await app.init();

    const quiz = await quizzesRepo.create('host1', 'Integration Quiz');
    quizId = quiz.id;
    const question = await questionsRepo.create(quizId, {
      type: 'MULTIPLE_CHOICE',
      prompt: 'Capital of France?',
      options: [
        { id: 'a', label: 'Paris', isCorrect: true },
        { id: 'b', label: 'Lyon', isCorrect: false },
      ],
      accepted_answers: null,
      correct_numeric: null,
      points: 5,
      time_limit_seconds: 20,
      order_index: 0,
    });
    questionId = question.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('drives a full session from LOBBY through FINISHED, grading an answer along the way', async () => {
    const server = app.getHttpServer();

    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    expect(createRes.status).toBe(201);
    const sessionId: string = createRes.body.id;

    const joinRes = await request(server).post(`/sessions/${sessionId}/teams/join`).send({ name: 'The Quizzards' });
    expect(joinRes.status).toBe(201);
    const teamToken: string = joinRes.body.token;

    await request(server)
      .post(`/sessions/${sessionId}/transition`)
      .send({ status: 'LOCK_IN_ROUND', questionId })
      .expect(201);

    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_ACTIVE' }).expect(201);

    const submitRes = await request(server)
      .post(`/sessions/${sessionId}/answers`)
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ questionId, response: { optionId: 'a' } });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.isCorrect).toBe(true);

    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_REVEAL' }).expect(201);
    await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'FINISHED' }).expect(201);

    const stateRes = await request(server).get(`/sessions/${sessionId}/state`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.status).toBe('FINISHED');
    expect(stateRes.body.teams).toEqual([expect.objectContaining({ name: 'The Quizzards', score: 5 })]);
  });

  it('rejects an illegal transition with 409 and the current state', async () => {
    const server = app.getHttpServer();
    const createRes = await request(server).post(`/quizzes/${quizId}/sessions`).send({});
    const sessionId: string = createRes.body.id;

    const res = await request(server).post(`/sessions/${sessionId}/transition`).send({ status: 'QUESTION_ACTIVE' });

    expect(res.status).toBe(409);
    expect(res.body.currentState).toBe('LOBBY');
  });
});
```

- [ ] **Step 6: Run the full API test suite and verify everything passes**

Run: `pnpm --filter api test`
Expected: PASS — every unit test from Tasks 4–15 plus both integration test cases.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/data/quizzes.repository.ts apps/api/src/data/quizzes.repository.spec.ts apps/api/src/data/data.module.ts apps/api/src/quizzes apps/api/src/questions apps/api/src/sessions apps/api/src/quiz-engine/invalid-transition.filter.ts apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/test-utils/in-memory-repositories.ts apps/api/src/session-lifecycle.integration.spec.ts
git commit -m "feat(api): wire quizzes/questions/sessions controllers and add full-lifecycle integration test"
```

---

## Task 16: Frontend Scaffold — PWA, Tailwind, API/Supabase Clients, Router

**Files:**
- Modify: `apps/web/vite.config.ts` (add Tailwind/PWA plugins)
- Create: `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`, `apps/web/src/index.css`
- Create: `apps/web/public/favicon.svg`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/supabase-client.ts`
- Create: `apps/web/src/host/HostApp.tsx`, `apps/web/src/projector/ProjectorApp.tsx`, `apps/web/src/play/PlayApp.tsx` (stubs — fleshed out in Tasks 18–20)
- Modify: `apps/web/src/App.tsx` (split into `AppRoutes` + `App`, add the three lazy route trees)
- Modify: `apps/web/src/main.tsx` (import `index.css`)
- Modify: `apps/web/src/App.test.tsx` (add routing coverage)
- Modify: `apps/web/.env.example` (create)

**Interfaces:**
- Produces: `apiGet<T>(path, token?): Promise<T>`, `apiPost<T>(path, body, token?): Promise<T>`, `ApiError` (consumed by Tasks 18–20); `subscribeToSession(sessionId, onEvent): () => void` where `onEvent: (event: 'STATE_CHANGE' | 'SCORE_UPDATE', payload: Record<string, unknown>) => void` (consumed by Tasks 19, 20); route stubs each render a root element with a stable `data-testid` (`host-app`, `projector-app`, `play-app`) that Tasks 18–20 must preserve.

- [ ] **Step 1: Add Tailwind, PostCSS, and the PWA plugin config**

`apps/web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`apps/web/postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`apps/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/web/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0f172a" />
  <text x="32" y="42" font-size="32" font-family="sans-serif" fill="#facc15" text-anchor="middle">Q</text>
</svg>
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Quizicius',
        short_name: 'Quizicius',
        description: 'Real-time pub quiz platform',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`apps/web/.env.example`:
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 2: Add the API and Supabase clients**

`apps/web/src/lib/api-client.ts`:
```ts
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function authHeader(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, token?: string): Promise<T> {
  return request<T>(path, { headers: authHeader(token) });
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body), headers: authHeader(token) });
}
```

`apps/web/src/lib/supabase-client.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export type SessionBroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE';

export function subscribeToSession(
  sessionId: string,
  onEvent: (event: SessionBroadcastEvent, payload: Record<string, unknown>) => void,
): () => void {
  const channel = supabase.channel(`quiz:${sessionId}`);
  channel
    .on('broadcast', { event: 'STATE_CHANGE' }, ({ payload }) => onEvent('STATE_CHANGE', payload))
    .on('broadcast', { event: 'SCORE_UPDATE' }, ({ payload }) => onEvent('SCORE_UPDATE', payload))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

- [ ] **Step 3: Add route stubs and the router**

`apps/web/src/host/HostApp.tsx`:
```tsx
export default function HostApp() {
  return <div data-testid="host-app">Quizicius Host</div>;
}
```

`apps/web/src/projector/ProjectorApp.tsx`:
```tsx
export default function ProjectorApp() {
  return <div data-testid="projector-app">Quizicius Projector</div>;
}
```

`apps/web/src/play/PlayApp.tsx`:
```tsx
export default function PlayApp() {
  return <div data-testid="play-app">Quizicius Play</div>;
}
```

`apps/web/src/App.tsx`:
```tsx
import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const HostApp = lazy(() => import('./host/HostApp'));
const ProjectorApp = lazy(() => import('./projector/ProjectorApp'));
const PlayApp = lazy(() => import('./play/PlayApp'));

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <Routes>
        <Route path="/host/*" element={<HostApp />} />
        <Route path="/projector/:sessionId" element={<ProjectorApp />} />
        <Route path="/play/:sessionId?" element={<PlayApp />} />
        <Route path="*" element={<div className="p-8 text-center">Quizicius</div>} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: Write the failing routing tests**

`apps/web/src/App.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App, { AppRoutes } from './App';

describe('App', () => {
  it('renders the fallback route at an unmatched path', () => {
    render(<App />);
    expect(screen.getByText('Quizicius')).toBeInTheDocument();
  });
});

describe('AppRoutes', () => {
  it('resolves /host/* to the host app', async () => {
    render(
      <MemoryRouter initialEntries={['/host']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('host-app')).toBeInTheDocument());
  });

  it('resolves /projector/:sessionId to the projector app', async () => {
    render(
      <MemoryRouter initialEntries={['/projector/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('projector-app')).toBeInTheDocument());
  });

  it('resolves /play/:sessionId to the play app', async () => {
    render(
      <MemoryRouter initialEntries={['/play/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('play-app')).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run tests to verify they pass, then confirm the production build works**

Run: `pnpm --filter web test`
Expected: PASS (4 tests)

Run: `pnpm --filter web build`
Expected: succeeds, emitting a service worker and web manifest alongside the usual Vite output.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold PWA shell with Tailwind, API/Supabase clients, and routed views"
```

---

## Task 17: `useQuizSecurity` Anti-Cheat Hook

**Files:**
- Create: `apps/web/src/play/use-quiz-security.ts`
- Test: `apps/web/src/play/use-quiz-security.test.ts`

**Interfaces:**
- Consumes: `apiPost` (Task 16), `QuizState` (`@quizicius/shared-types`).
- Produces: `useQuizSecurity(status: QuizState, teamToken: string | null): { requestFullscreenNow: () => void }`. Wake Lock is requested automatically from a `useEffect` on `LOCK_IN_ROUND`/`QUESTION_ACTIVE` — the Wake Lock API allows this from any context. The Fullscreen API does not: browsers only grant `requestFullscreen()` when it's called synchronously from a real user gesture (click/tap), so the effect's own fullscreen attempt is best-effort only, and the hook also returns `requestFullscreenNow`, meant to be wired to the "Tap to Lock-In" overlay's `onClick` in `/play` (Task 22) so fullscreen reliably activates from that tap. Both cases release on any other state, and the hook reports a `VISIBILITY_HIDDEN` infraction via `POST /api/infractions/report` on `visibilitychange` while a round is active.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/play/use-quiz-security.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizSecurity } from './use-quiz-security';

function mockWakeLock() {
  const sentinel = { release: vi.fn().mockResolvedValue(undefined) };
  const request = vi.fn().mockResolvedValue(sentinel);
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinel };
}

describe('useQuizSecurity', () => {
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestFullscreen = vi.fn().mockResolvedValue(undefined);
    exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', { value: exitFullscreen, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('activates Wake Lock and Fullscreen on QUESTION_ACTIVE', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('QUESTION_ACTIVE', 'team-token'));

    expect(request).toHaveBeenCalledWith('screen');
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it('activates anti-cheat on LOCK_IN_ROUND too', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('LOCK_IN_ROUND', 'team-token'));

    expect(request).toHaveBeenCalledWith('screen');
  });

  it('does not activate anti-cheat in LOBBY', () => {
    const { request } = mockWakeLock();
    renderHook(() => useQuizSecurity('LOBBY', 'team-token'));

    expect(request).not.toHaveBeenCalled();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('releases Wake Lock and exits Fullscreen when transitioning to QUESTION_REVEAL', async () => {
    const { request, sentinel } = mockWakeLock();
    const { rerender } = renderHook(({ status }) => useQuizSecurity(status, 'team-token'), {
      initialProps: { status: 'QUESTION_ACTIVE' as const },
    });

    // Let the initial wakeLock.request() settle before triggering cleanup.
    await act(async () => {
      await request.mock.results[0].value;
    });

    rerender({ status: 'QUESTION_REVEAL' as const });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sentinel.release).toHaveBeenCalled();
  });

  it('reports a VISIBILITY_HIDDEN infraction while a round is active', () => {
    mockWakeLock();
    renderHook(() => useQuizSecurity('QUESTION_ACTIVE', 'team-token'));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/infractions/report'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer team-token' }),
      }),
    );
  });

  it('does not report an infraction when no round is active', () => {
    mockWakeLock();
    renderHook(() => useQuizSecurity('LOBBY', 'team-token'));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('exposes requestFullscreenNow for a "Tap to Lock-In" gesture to call directly', () => {
    mockWakeLock();
    const { result } = renderHook(() => useQuizSecurity('LOCK_IN_ROUND', 'team-token'));
    requestFullscreen.mockClear(); // clear the effect's own best-effort attempt

    act(() => {
      result.current.requestFullscreenNow();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- use-quiz-security`
Expected: FAIL with "Cannot find module './use-quiz-security'"

- [ ] **Step 3: Implement the hook**

`apps/web/src/play/use-quiz-security.ts`:
```ts
import { MutableRefObject, useEffect, useRef } from 'react';
import { QuizState } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';

const ACTIVE_STATES: readonly QuizState[] = ['LOCK_IN_ROUND', 'QUESTION_ACTIVE'];

type WakeLockPromiseRef = MutableRefObject<Promise<WakeLockSentinel> | null>;

function requestWakeLock(ref: WakeLockPromiseRef): void {
  if (!('wakeLock' in navigator)) return;
  // Assigned synchronously so cleanup can always chain onto it, regardless of
  // whether the underlying request has resolved yet.
  ref.current = navigator.wakeLock.request('screen');
}

function releaseWakeLock(ref: WakeLockPromiseRef): void {
  const pending = ref.current;
  ref.current = null;
  void pending?.then((sentinel) => sentinel.release()).catch(() => {});
}

function requestFullscreen(): void {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    void el.requestFullscreen().catch(() => {});
  }
}

function exitFullscreenIfActive(): void {
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
  }
}

export function useQuizSecurity(
  status: QuizState,
  teamToken: string | null,
): { requestFullscreenNow: () => void } {
  const wakeLockRef = useRef<Promise<WakeLockSentinel> | null>(null);

  useEffect(() => {
    const isActive = ACTIVE_STATES.includes(status);

    if (!isActive) {
      releaseWakeLock(wakeLockRef);
      exitFullscreenIfActive();
      return;
    }

    requestWakeLock(wakeLockRef);
    requestFullscreen(); // best-effort; browsers usually reject this outside a user gesture

    return () => {
      releaseWakeLock(wakeLockRef);
    };
  }, [status]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      const isActive = ACTIVE_STATES.includes(status);
      if (document.visibilityState === 'hidden' && isActive && teamToken) {
        apiPost('/api/infractions/report', { type: 'VISIBILITY_HIDDEN' }, teamToken).catch(() => {
          // Best-effort — a failed infraction report must never block gameplay.
        });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, teamToken]);

  // Called from the "Tap to Lock-In" overlay's onClick (Task 22) — a real user gesture, so
  // requestFullscreen() is reliably granted here even when the effect above was rejected.
  function requestFullscreenNow(): void {
    requestFullscreen();
  }

  return { requestFullscreenNow };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- use-quiz-security`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/play/use-quiz-security.ts apps/web/src/play/use-quiz-security.test.ts
git commit -m "feat(web): add useQuizSecurity anti-cheat hook (Wake Lock, Fullscreen, visibility infractions)"
```

---

## Task 18: Backend — Paper-Mode Score Adjustments

The original prompt calls for a "paper-mode manual score entry grid" on `/host`, for rounds run entirely off-app (spoken round, physical answer sheets). Nothing in Tasks 1–15 lets a host award points outside the normal answer-grading pipeline, so this task adds that vertical slice before the host UI (Task 20) consumes it.

**Files:**
- Modify: `supabase/migrations/0001_init.sql` split is avoided — add a second migration instead: Create `supabase/migrations/0002_score_adjustments.sql`
- Create: `apps/api/src/data/score-adjustments.repository.ts`
- Test: `apps/api/src/data/score-adjustments.repository.spec.ts`
- Modify: `apps/api/src/data/data.module.ts` (register `ScoreAdjustmentsRepository`)
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.ts` (inject the repository, add `addPaperScore`, include adjustments in `getState`'s score sum)
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.spec.ts` (update harness, add coverage)
- Create: `apps/api/src/sessions/dto/add-paper-score.dto.ts`
- Modify: `apps/api/src/sessions/sessions.controller.ts` (add the endpoint)
- Modify: `apps/api/src/test-utils/in-memory-repositories.ts` (add `InMemoryScoreAdjustmentsRepository`, used by Task 15's integration test's DI graph)

**Interfaces:**
- Produces: `ScoreAdjustmentsRepository.create(sessionId, teamId, points, reason): Promise<ScoreAdjustmentRecord>`, `.listBySession(sessionId): Promise<ScoreAdjustmentRecord[]>`; `QuizEngineService.addPaperScore(sessionId, hostId, teamId, points, reason): Promise<ScoreAdjustmentRecord>`; `POST /sessions/:sessionId/teams/:teamId/paper-score` (host-only) — consumed by the host paper-mode grid (Task 20).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_score_adjustments.sql`:
```sql
create table score_adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  points integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index score_adjustments_session_idx on score_adjustments (session_id);
```

Run: `supabase db reset` (or re-apply via `psql` as in Task 3) and confirm the table exists.

- [ ] **Step 2: Write the failing repository test, then implement it**

`apps/api/src/data/score-adjustments.repository.spec.ts`:
```ts
import { fakeSupabaseService } from '../test-utils/supabase-mock';
import { ScoreAdjustmentRecord, SupabaseScoreAdjustmentsRepository } from './score-adjustments.repository';

const RECORD: ScoreAdjustmentRecord = {
  id: 'adj1',
  session_id: 's1',
  team_id: 't1',
  points: 3,
  reason: 'Paper round 2',
  created_at: '2026-09-16T00:00:00.000Z',
};

describe('SupabaseScoreAdjustmentsRepository', () => {
  it('creates a score adjustment', async () => {
    const supabase = fakeSupabaseService({ score_adjustments: { data: RECORD, error: null } });
    const repo = new SupabaseScoreAdjustmentsRepository(supabase);

    await expect(repo.create('s1', 't1', 3, 'Paper round 2')).resolves.toEqual(RECORD);
  });

  it('lists adjustments for a session', async () => {
    const supabase = fakeSupabaseService({ score_adjustments: { data: [RECORD], error: null } });
    const repo = new SupabaseScoreAdjustmentsRepository(supabase);

    await expect(repo.listBySession('s1')).resolves.toEqual([RECORD]);
  });
});
```

Run: `pnpm --filter api test -- score-adjustments.repository`
Expected: FAIL, then implement:

`apps/api/src/data/score-adjustments.repository.ts`:
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ScoreAdjustmentRecord {
  id: string;
  session_id: string;
  team_id: string;
  points: number;
  reason: string | null;
  created_at: string;
}

export abstract class ScoreAdjustmentsRepository {
  abstract create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord>;
  abstract listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]>;
}

@Injectable()
export class SupabaseScoreAdjustmentsRepository extends ScoreAdjustmentsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('score_adjustments')
      .insert({ session_id: sessionId, team_id: teamId, points, reason })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ScoreAdjustmentRecord;
  }

  async listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('score_adjustments')
      .select()
      .eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as ScoreAdjustmentRecord[];
  }
}
```

Register it in `apps/api/src/data/data.module.ts` the same way as the other five repositories (add to both `providers` and `exports`).

Run: `pnpm --filter api test -- score-adjustments.repository`
Expected: PASS

- [ ] **Step 3: Wire it into `QuizEngineService`**

In `apps/api/src/quiz-engine/quiz-engine.service.spec.ts`: import `ScoreAdjustmentsRepository`, add `const scoreAdjustments: ScoreAdjustmentsRepository = { create: jest.fn(), listBySession: jest.fn().mockResolvedValue([]) };` to `buildHarness`, include it in the `new QuizEngineService(...)` call as the final argument, and return it from the harness. Then add:
```ts
describe('QuizEngineService.addPaperScore', () => {
  it('records a manual score adjustment for a host-owned session', async () => {
    const { service, scoreAdjustments } = buildHarness();

    await service.addPaperScore('s1', 'host1', 't1', 3, 'Paper round 2');

    expect(scoreAdjustments.create).toHaveBeenCalledWith('s1', 't1', 3, 'Paper round 2');
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.addPaperScore('s1', 'someone-else', 't1', 3, null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
```
Add a case to `QuizEngineService.getState`'s describe block:
```ts
  it('includes paper-mode score adjustments in each team total', async () => {
    const { service, teams, scoreAdjustments } = buildHarness({ session: { status: 'LOBBY' } });
    (teams.listBySession as jest.Mock).mockResolvedValue([
      { id: 't1', session_id: 's1', name: 'Team A', device_token_hash: null, joined_at: 'now', is_active: true },
    ]);
    (scoreAdjustments.listBySession as jest.Mock).mockResolvedValue([
      { id: 'a1', session_id: 's1', team_id: 't1', points: 3, reason: null, created_at: 'now' },
    ]);

    const state = await service.getState('s1');

    expect(state.teams[0].score).toBe(3);
  });
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: FAIL (constructor arity mismatch / adjustments not summed)

In `apps/api/src/quiz-engine/quiz-engine.service.ts`: import `ScoreAdjustmentsRepository`, add it as the final constructor parameter, fetch it alongside the other `Promise.all` entries in `getState`, and fold its points into `scoreByTeam`:
```ts
      this.scoreAdjustments.listBySession(sessionId),
```
(added to the `Promise.all` array, destructured as `scoreAdjustments`), then after the existing `for (const answer of answers)` loop:
```ts
    for (const adjustment of scoreAdjustments) {
      scoreByTeam.set(adjustment.team_id, (scoreByTeam.get(adjustment.team_id) ?? 0) + adjustment.points);
    }
```
And add the new method:
```ts
  async addPaperScore(
    sessionId: string,
    hostId: string,
    teamId: string,
    points: number,
    reason: string | null,
  ): Promise<ScoreAdjustmentRecord> {
    await this.requireOwnedSession(sessionId, hostId);
    const adjustment = await this.scoreAdjustments.create(sessionId, teamId, points, reason);
    await this.broadcast.publish(sessionId, 'SCORE_UPDATE', { teamId });
    return adjustment;
  }
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: PASS (all prior tests plus the new paper-score cases)

- [ ] **Step 4: Add the endpoint**

`apps/api/src/sessions/dto/add-paper-score.dto.ts`:
```ts
import { IsInt, IsOptional, IsString } from 'class-validator';

export class AddPaperScoreDto {
  @IsInt()
  points!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

Add to `apps/api/src/sessions/sessions.controller.ts`:
```ts
  @Post('sessions/:sessionId/teams/:teamId/paper-score')
  @UseGuards(SupabaseAuthGuard)
  addPaperScore(
    @Param('sessionId') sessionId: string,
    @Param('teamId') teamId: string,
    @CurrentHost() host: CurrentHostPayload,
    @Body() dto: AddPaperScoreDto,
  ) {
    return this.quizEngine.addPaperScore(sessionId, host.id, teamId, dto.points, dto.reason ?? null);
  }
```
(with the matching `import { AddPaperScoreDto } from './dto/add-paper-score.dto';` added at the top)

- [ ] **Step 5: Extend the integration test's in-memory repositories**

Add to `apps/api/src/test-utils/in-memory-repositories.ts`:
```ts
export class InMemoryScoreAdjustmentsRepository extends ScoreAdjustmentsRepository {
  private rows: ScoreAdjustmentRecord[] = [];

  async create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord> {
    const record: ScoreAdjustmentRecord = {
      id: randomUUID(),
      session_id: sessionId,
      team_id: teamId,
      points,
      reason,
      created_at: new Date().toISOString(),
    };
    this.rows.push(record);
    return record;
  }

  async listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]> {
    return this.rows.filter((r) => r.session_id === sessionId);
  }
}
```
(with the matching `ScoreAdjustmentRecord, ScoreAdjustmentsRepository` import added from `../data/score-adjustments.repository`)

In `apps/api/src/session-lifecycle.integration.spec.ts`, add `.overrideProvider(ScoreAdjustmentsRepository).useValue(new InMemoryScoreAdjustmentsRepository())` to the testing module builder chain (alongside the other five `overrideProvider` calls).

Run: `pnpm --filter api test`
Expected: PASS — full suite green, including the still-passing integration test.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_score_adjustments.sql apps/api/src/data/score-adjustments.repository.ts apps/api/src/data/score-adjustments.repository.spec.ts apps/api/src/data/data.module.ts apps/api/src/quiz-engine/quiz-engine.service.ts apps/api/src/quiz-engine/quiz-engine.service.spec.ts apps/api/src/sessions apps/api/src/test-utils/in-memory-repositories.ts
git commit -m "feat(api): add paper-mode manual score adjustments"
```

---

## Task 19: `/host` — Auth, Quiz/Question Management, Session Control

**Files:**
- Create: `apps/web/src/lib/use-host-session.ts`
- Create: `apps/web/src/lib/use-session-state.ts`
- Create: `apps/web/src/host/LoginScreen.tsx`
- Create: `apps/web/src/host/QuizDashboard.tsx`
- Create: `apps/web/src/host/SessionControlPanel.tsx`
- Modify: `apps/web/src/host/HostApp.tsx`
- Test: `apps/web/src/host/LoginScreen.test.tsx`
- Test: `apps/web/src/host/QuizDashboard.test.tsx`
- Test: `apps/web/src/host/SessionControlPanel.test.tsx`

**Interfaces:**
- Consumes: `apiGet`/`apiPost` (Task 16), `subscribeToSession` (Task 16), `QuizSessionStateDto`/`QuizState` (`@quizicius/shared-types`).
- Produces: `useHostSession(): { session: Session | null; loading: boolean; token: string | null }`; `useSessionState(sessionId): { state: QuizSessionStateDto | null; error: string | null; refetch: () => void }` — reusable by `/projector` (Task 21) and `/play` (Task 22), since both need "fetch state on mount, refetch on any broadcast" and neither needs to merge partial broadcast payloads client-side (REST is always the source of truth per the design doc).

- [ ] **Step 1: Write the shared hooks**

`apps/web/src/lib/use-host-session.ts`:
```ts
import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase-client';

export function useHostSession(): { session: Session | null; loading: boolean; token: string | null } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, loading, token: session?.access_token ?? null };
}
```

`apps/web/src/lib/use-session-state.ts`:
```ts
import { QuizSessionStateDto } from '@quizicius/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './api-client';
import { subscribeToSession } from './supabase-client';

export function useSessionState(sessionId: string | undefined): {
  state: QuizSessionStateDto | null;
  error: string | null;
  refetch: () => void;
} {
  const [state, setState] = useState<QuizSessionStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!sessionId) return;
    apiGet<QuizSessionStateDto>(`/sessions/${sessionId}/state`)
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'));
  }, [sessionId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToSession(sessionId, () => refetch());
  }, [sessionId, refetch]);

  return { state, error, refetch };
}
```

- [ ] **Step 2: Write the failing `LoginScreen` test, then implement it**

`apps/web/src/host/LoginScreen.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase-client';
import LoginScreen from './LoginScreen';

vi.mock('../lib/supabase-client', () => ({
  supabase: { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } },
}));

describe('LoginScreen', () => {
  it('submits email and password to Supabase Auth', async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'host@example.com',
      password: 'hunter2',
    });
  });

  it('shows the error message on a failed sign-in', async () => {
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: { message: 'Invalid credentials' },
    });
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- LoginScreen`
Expected: FAIL, then implement:

`apps/web/src/host/LoginScreen.tsx`:
```tsx
import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase-client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Host sign in</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded border px-3 py-2"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="rounded border px-3 py-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white">
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
```

Run: `pnpm --filter web test -- LoginScreen`
Expected: PASS

- [ ] **Step 3: Write the failing `QuizDashboard` test, then implement it**

`apps/web/src/host/QuizDashboard.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { QuizDashboard } from './QuizDashboard';

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

describe('QuizDashboard', () => {
  it('lists existing quizzes and creates a new one', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'q1', title: 'Existing Quiz' }]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'q2', title: 'New Quiz' });

    render(<QuizDashboard token="host-token" onSessionCreated={vi.fn()} />);

    expect(await screen.findByText('Existing Quiz')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('New quiz title'), { target: { value: 'New Quiz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'New Quiz' }, 'host-token'),
    );
    expect(await screen.findByText('New Quiz')).toBeInTheDocument();
  });

  it('starts a session for a quiz and reports the new session id', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'q1', title: 'Existing Quiz' }]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'session-1', join_code: 'AB12' });
    const onSessionCreated = vi.fn();

    render(<QuizDashboard token="host-token" onSessionCreated={onSessionCreated} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }));

    await waitFor(() => expect(onSessionCreated).toHaveBeenCalledWith('session-1'));
  });
});
```

Run: `pnpm --filter web test -- QuizDashboard`
Expected: FAIL, then implement:

`apps/web/src/host/QuizDashboard.tsx`:
```tsx
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api-client';

interface QuizSummary {
  id: string;
  title: string;
}

interface QuestionFormProps {
  quizId: string;
  token: string;
  onCreated: () => void;
}

function QuestionForm({ quizId, token, onCreated }: QuestionFormProps) {
  const [prompt, setPrompt] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [correct, setCorrect] = useState<'a' | 'b'>('a');
  const [points, setPoints] = useState(1);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await apiPost(
      `/quizzes/${quizId}/questions`,
      {
        type: 'MULTIPLE_CHOICE',
        prompt,
        options: [
          { id: 'a', label: optionA, isCorrect: correct === 'a' },
          { id: 'b', label: optionB, isCorrect: correct === 'b' },
        ],
        points,
        orderIndex: 0,
      },
      token,
    );
    setPrompt('');
    setOptionA('');
    setOptionB('');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-dashed p-3">
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Question prompt"
        className="w-full rounded border px-2 py-1"
        required
      />
      <div className="flex gap-2">
        <input
          value={optionA}
          onChange={(e) => setOptionA(e.target.value)}
          placeholder="Option A"
          className="flex-1 rounded border px-2 py-1"
          required
        />
        <input
          value={optionB}
          onChange={(e) => setOptionB(e.target.value)}
          placeholder="Option B"
          className="flex-1 rounded border px-2 py-1"
          required
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <label>
          <input type="radio" checked={correct === 'a'} onChange={() => setCorrect('a')} /> A is correct
        </label>
        <label>
          <input type="radio" checked={correct === 'b'} onChange={() => setCorrect('b')} /> B is correct
        </label>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-16 rounded border px-2 py-1"
        />
      </div>
      <button type="submit" className="rounded bg-slate-700 px-3 py-1 text-sm text-white">
        Add question
      </button>
    </form>
  );
}

export function QuizDashboard({
  token,
  onSessionCreated,
}: {
  token: string;
  onSessionCreated: (sessionId: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [title, setTitle] = useState('');
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    apiGet<QuizSummary[]>('/quizzes', token).then(setQuizzes);
  }, [token]);

  async function handleCreateQuiz(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim()) return;
    const quiz = await apiPost<QuizSummary>('/quizzes', { title }, token);
    setQuizzes((prev) => [...prev, quiz]);
    setTitle('');
  }

  async function handleCreateSession(quizId: string): Promise<void> {
    const session = await apiPost<{ id: string; join_code: string }>(`/quizzes/${quizId}/sessions`, {}, token);
    onSessionCreated(session.id);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-semibold">Your quizzes</h2>
      <form onSubmit={handleCreateQuiz} className="mb-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New quiz title"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Create quiz
        </button>
      </form>
      <ul className="space-y-4">
        {quizzes.map((quiz) => (
          <li key={quiz.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <span>
                {quiz.title} ({questionCounts[quiz.id] ?? 0} questions added)
              </span>
              <button
                onClick={() => handleCreateSession(quiz.id)}
                className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
              >
                Start session
              </button>
            </div>
            <QuestionForm
              quizId={quiz.id}
              token={token}
              onCreated={() => setQuestionCounts((prev) => ({ ...prev, [quiz.id]: (prev[quiz.id] ?? 0) + 1 }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm --filter web test -- QuizDashboard`
Expected: PASS

- [ ] **Step 4: Write the failing `SessionControlPanel` test, then implement it**

`apps/web/src/host/SessionControlPanel.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { subscribeToSession } from '../lib/supabase-client';
import { SessionControlPanel } from './SessionControlPanel';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

const STATE = {
  id: 's1',
  joinCode: 'AB12',
  status: 'LOBBY',
  currentQuestion: null,
  questionEndsAt: null,
  teams: [{ id: 't1', name: 'The Quizzards', isActive: true, score: 4, infractionCount: 1 }],
};

describe('SessionControlPanel', () => {
  it('renders the join code, status, teams, and legal next-state buttons', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);

    render(<SessionControlPanel sessionId="s1" token="host-token" />);

    expect(await screen.findByText('Join code: AB12')).toBeInTheDocument();
    expect(screen.getByText(/The Quizzards/)).toBeInTheDocument();
    expect(screen.getByText(/4 pts/)).toBeInTheDocument();
    expect(screen.getByText(/1 flag/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOCK_IN_ROUND' })).toBeInTheDocument();
  });

  it('posts a transition when a next-state button is clicked', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<SessionControlPanel sessionId="s1" token="host-token" />);
    fireEvent.click(await screen.findByRole('button', { name: 'LOCK_IN_ROUND' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/transition',
      { status: 'LOCK_IN_ROUND', questionId: '' },
      'host-token',
    );
  });

  it('subscribes to realtime broadcasts for this session', () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);
    render(<SessionControlPanel sessionId="s1" token="host-token" />);
    expect(subscribeToSession).toHaveBeenCalledWith('s1', expect.any(Function));
  });
});
```

Run: `pnpm --filter web test -- SessionControlPanel`
Expected: FAIL, then implement:

`apps/web/src/host/SessionControlPanel.tsx`:
```tsx
import { QuizState } from '@quizicius/shared-types';
import { useState } from 'react';
import { apiPost } from '../lib/api-client';
import { useSessionState } from '../lib/use-session-state';

const NEXT_STATES: Record<QuizState, QuizState[]> = {
  LOBBY: ['LOCK_IN_ROUND'],
  LOCK_IN_ROUND: ['QUESTION_ACTIVE'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL'],
  QUESTION_REVEAL: ['LOCK_IN_ROUND', 'PAUSE_BREAK', 'FINISHED'],
  PAUSE_BREAK: ['LOCK_IN_ROUND'],
  FINISHED: [],
};

export function SessionControlPanel({ sessionId, token }: { sessionId: string; token: string }) {
  const { state, refetch } = useSessionState(sessionId);
  const [nextQuestionId, setNextQuestionId] = useState('');

  async function transition(status: QuizState): Promise<void> {
    const body = status === 'LOCK_IN_ROUND' ? { status, questionId: nextQuestionId } : { status };
    await apiPost(`/sessions/${sessionId}/transition`, body, token);
    refetch();
  }

  if (!state) return <p className="p-6">Loading session…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-xl font-semibold">Join code: {state.joinCode}</h2>
      <p className="mb-4 text-sm text-slate-500">Status: {state.status}</p>

      {state.status !== 'QUESTION_ACTIVE' && state.status !== 'QUESTION_REVEAL' && (
        <input
          value={nextQuestionId}
          onChange={(e) => setNextQuestionId(e.target.value)}
          placeholder="Next question id"
          className="mb-2 w-full rounded border px-3 py-2"
        />
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {NEXT_STATES[state.status].map((next) => (
          <button
            key={next}
            onClick={() => transition(next)}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            {next}
          </button>
        ))}
      </div>

      <h3 className="mb-2 font-semibold">Teams</h3>
      <ul className="space-y-1">
        {state.teams.map((team) => (
          <li key={team.id} className="flex justify-between rounded border px-3 py-2 text-sm">
            <span>{team.name}</span>
            <span>
              {team.score} pts{team.infractionCount > 0 ? ` · ${team.infractionCount} flag(s)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm --filter web test -- SessionControlPanel`
Expected: PASS

- [ ] **Step 5: Wire it all into `HostApp`**

`apps/web/src/host/HostApp.tsx`:
```tsx
import { useState } from 'react';
import { useHostSession } from '../lib/use-host-session';
import LoginScreen from './LoginScreen';
import { QuizDashboard } from './QuizDashboard';
import { SessionControlPanel } from './SessionControlPanel';

export default function HostApp() {
  const { session, loading, token } = useHostSession();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  if (loading) {
    return <div data-testid="host-app">Loading…</div>;
  }
  if (!session || !token) {
    return (
      <div data-testid="host-app">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div data-testid="host-app">
      {activeSessionId ? (
        <SessionControlPanel sessionId={activeSessionId} token={token} />
      ) : (
        <QuizDashboard token={token} onSessionCreated={setActiveSessionId} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the full web test suite and commit**

Run: `pnpm --filter web test`
Expected: PASS — every test from Tasks 16, 17, and 19.

```bash
git add apps/web/src/lib/use-host-session.ts apps/web/src/lib/use-session-state.ts apps/web/src/host
git commit -m "feat(web): add host auth, quiz/question management, and session control panel"
```

---

## Task 20: `/host` — Dispute Queue & Paper-Mode UI

**Files:**
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.ts` (add `listDisputes`)
- Modify: `apps/api/src/quiz-engine/quiz-engine.service.spec.ts` (test it)
- Modify: `apps/api/src/sessions/sessions.controller.ts` (add `GET /sessions/:sessionId/disputes`)
- Create: `apps/web/src/host/DisputeQueue.tsx`
- Create: `apps/web/src/host/PaperModeGrid.tsx`
- Create: `apps/web/src/host/SessionView.tsx`
- Modify: `apps/web/src/host/HostApp.tsx` (render `SessionView` instead of `SessionControlPanel` directly)
- Test: `apps/web/src/host/DisputeQueue.test.tsx`
- Test: `apps/web/src/host/PaperModeGrid.test.tsx`
- Test: `apps/web/src/host/SessionView.test.tsx`

**Interfaces:**
- Consumes: `AnswersRepository.listNeedsReview` (Task 8), `apiGet`/`apiPost` (Task 16), `useSessionState` (Task 19), `AnswerSummaryDto`/`TeamSummaryDto` (Task 2).
- Produces: `QuizEngineService.listDisputes(sessionId, hostId): Promise<AnswerRecord[]>`; `GET /sessions/:sessionId/disputes` (host-only, feeds the dispute queue's free-text-review list, distinct from `GET /sessions/:sessionId/infractions` which already exists from Task 14).

- [ ] **Step 1: Add `listDisputes` to `QuizEngineService`**

Add to `apps/api/src/quiz-engine/quiz-engine.service.spec.ts`:
```ts
describe('QuizEngineService.listDisputes', () => {
  it('returns answers needing review for a host-owned session', async () => {
    const { service, answers } = buildHarness();
    (answers.listNeedsReview as jest.Mock).mockResolvedValue([{ id: 'a1', needs_review: true }]);

    const result = await service.listDisputes('s1', 'host1');

    expect(answers.listNeedsReview).toHaveBeenCalledWith('s1');
    expect(result).toEqual([{ id: 'a1', needs_review: true }]);
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.listDisputes('s1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: FAIL (`listDisputes` does not exist)

Add to `apps/api/src/quiz-engine/quiz-engine.service.ts` (near `resolveDispute`):
```ts
  async listDisputes(sessionId: string, hostId: string): Promise<AnswerRecord[]> {
    await this.requireOwnedSession(sessionId, hostId);
    return this.answers.listNeedsReview(sessionId);
  }
```

Run: `pnpm --filter api test -- quiz-engine.service`
Expected: PASS

Add to `apps/api/src/sessions/sessions.controller.ts`:
```ts
  @Get('sessions/:sessionId/disputes')
  @UseGuards(SupabaseAuthGuard)
  listDisputes(@Param('sessionId') sessionId: string, @CurrentHost() host: CurrentHostPayload) {
    return this.quizEngine.listDisputes(sessionId, host.id);
  }
```
(add `Get` to the existing `@nestjs/common` import if not already present)

Run: `pnpm --filter api test`
Expected: PASS (full API suite, including the still-passing integration test)

```bash
git add apps/api/src/quiz-engine/quiz-engine.service.ts apps/api/src/quiz-engine/quiz-engine.service.spec.ts apps/api/src/sessions/sessions.controller.ts
git commit -m "feat(api): add host-facing free-text dispute list endpoint"
```

- [ ] **Step 2: Write the failing `DisputeQueue` test, then implement it**

`apps/web/src/host/DisputeQueue.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { DisputeQueue } from './DisputeQueue';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

const DISPUTE = {
  id: 'a1',
  sessionId: 's1',
  questionId: 'q1',
  teamId: 't1',
  response: { text: 'Pahhris' },
  isCorrect: null,
  confidence: 0.71,
  needsReview: true,
  gradedBy: null,
  scoreAwarded: 0,
};

describe('DisputeQueue', () => {
  it('lists disputed answers and approves one', async () => {
    (apiGet as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([DISPUTE])
      .mockResolvedValueOnce([]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    expect(await screen.findByText(/Pahhris/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(apiPost).toHaveBeenCalledWith('/answers/a1/resolve-dispute', { decision: 'APPROVE' }, 'host-token');
  });

  it('shows an empty state with no disputes or infractions', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    expect(await screen.findByText('No free-text answers need review.')).toBeInTheDocument();
    expect(screen.getByText('No infractions reported.')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- DisputeQueue`
Expected: FAIL, then implement:

`apps/web/src/host/DisputeQueue.tsx`:
```tsx
import { AnswerSummaryDto } from '@quizicius/shared-types';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api-client';

interface InfractionSummary {
  id: string;
  team_id: string;
  type: string;
}

export function DisputeQueue({ sessionId, token }: { sessionId: string; token: string }) {
  const [disputes, setDisputes] = useState<AnswerSummaryDto[]>([]);
  const [infractions, setInfractions] = useState<InfractionSummary[]>([]);

  async function load(): Promise<void> {
    const [disputeRows, infractionRows] = await Promise.all([
      apiGet<AnswerSummaryDto[]>(`/sessions/${sessionId}/disputes`, token),
      apiGet<InfractionSummary[]>(`/sessions/${sessionId}/infractions`, token),
    ]);
    setDisputes(disputeRows);
    setInfractions(infractionRows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  async function resolve(answerId: string, decision: 'APPROVE' | 'REJECT'): Promise<void> {
    await apiPost(`/answers/${answerId}/resolve-dispute`, { decision }, token);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-2 text-xl font-semibold">Dispute queue</h2>
      {disputes.length === 0 ? (
        <p className="text-sm text-slate-500">No free-text answers need review.</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {disputes.map((answer) => (
            <li key={answer.id} className="flex items-center justify-between rounded border p-3">
              <span>
                Team {answer.teamId} answered &quot;{(answer.response as { text?: string }).text}&quot; (confidence{' '}
                {Math.round((answer.confidence ?? 0) * 100)}%)
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => resolve(answer.id, 'APPROVE')}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => resolve(answer.id, 'REJECT')}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                >
                  Reject
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-xl font-semibold">Infractions</h2>
      {infractions.length === 0 ? (
        <p className="text-sm text-slate-500">No infractions reported.</p>
      ) : (
        <ul className="space-y-1">
          {infractions.map((infraction) => (
            <li key={infraction.id} className="rounded border px-3 py-2 text-sm">
              Team {infraction.team_id} — {infraction.type}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Run: `pnpm --filter web test -- DisputeQueue`
Expected: PASS

- [ ] **Step 3: Write the failing `PaperModeGrid` test, then implement it**

`apps/web/src/host/PaperModeGrid.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { PaperModeGrid } from './PaperModeGrid';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('PaperModeGrid', () => {
  it('awards manual points to a team', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'PAUSE_BREAK',
      currentQuestion: null,
      questionEndsAt: null,
      teams: [{ id: 't1', name: 'The Quizzards', isActive: true, score: 0, infractionCount: 0 }],
    });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<PaperModeGrid sessionId="s1" token="host-token" />);

    const pointsInput = await screen.findByRole('spinbutton');
    fireEvent.change(pointsInput, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Award' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/teams/t1/paper-score',
      { points: 3, reason: undefined },
      'host-token',
    );
  });
});
```

Run: `pnpm --filter web test -- PaperModeGrid`
Expected: FAIL, then implement:

`apps/web/src/host/PaperModeGrid.tsx`:
```tsx
import { useState } from 'react';
import { apiPost } from '../lib/api-client';
import { useSessionState } from '../lib/use-session-state';

export function PaperModeGrid({ sessionId, token }: { sessionId: string; token: string }) {
  const { state } = useSessionState(sessionId);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  async function award(teamId: string): Promise<void> {
    const value = Number(points[teamId] ?? 0);
    if (!value) return;
    await apiPost(`/sessions/${sessionId}/teams/${teamId}/paper-score`, { points: value, reason: reason || undefined }, token);
    setPoints((prev) => ({ ...prev, [teamId]: '' }));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-2 text-xl font-semibold">Paper-mode scoring</h2>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Round reason (optional)"
        className="mb-3 w-full rounded border px-3 py-2"
      />
      <ul className="space-y-2">
        {(state?.teams ?? []).map((team) => (
          <li key={team.id} className="flex items-center justify-between gap-2 rounded border p-3">
            <span>{team.name}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                value={points[team.id] ?? ''}
                onChange={(e) => setPoints((prev) => ({ ...prev, [team.id]: e.target.value }))}
                className="w-20 rounded border px-2 py-1"
              />
              <button onClick={() => award(team.id)} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                Award
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm --filter web test -- PaperModeGrid`
Expected: PASS

- [ ] **Step 4: Add `SessionView` tabs and wire it into `HostApp`**

`apps/web/src/host/SessionView.tsx`:
```tsx
import { useState } from 'react';
import { DisputeQueue } from './DisputeQueue';
import { PaperModeGrid } from './PaperModeGrid';
import { SessionControlPanel } from './SessionControlPanel';

type Tab = 'controls' | 'disputes' | 'paper';
const TABS: Tab[] = ['controls', 'disputes', 'paper'];

export function SessionView({ sessionId, token }: { sessionId: string; token: string }) {
  const [tab, setTab] = useState<Tab>('controls');

  return (
    <div>
      <nav className="mx-auto flex max-w-2xl gap-2 px-6 pt-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'controls' && <SessionControlPanel sessionId={sessionId} token={token} />}
      {tab === 'disputes' && <DisputeQueue sessionId={sessionId} token={token} />}
      {tab === 'paper' && <PaperModeGrid sessionId={sessionId} token={token} />}
    </div>
  );
}
```

`apps/web/src/host/SessionView.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import { SessionView } from './SessionView';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn().mockResolvedValue([]), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('SessionView', () => {
  it('switches between the controls, disputes, and paper-mode tabs', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'LOBBY',
      currentQuestion: null,
      questionEndsAt: null,
      teams: [],
    });

    render(<SessionView sessionId="s1" token="host-token" />);
    expect(await screen.findByText('Join code: AB12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'paper' }));
    expect(await screen.findByText('Paper-mode scoring')).toBeInTheDocument();
  });
});
```

Update `apps/web/src/host/HostApp.tsx` to import `SessionView` instead of `SessionControlPanel` and render `<SessionView sessionId={activeSessionId} token={token} />` in place of `<SessionControlPanel ... />`.

Run: `pnpm --filter web test`
Expected: PASS — full web suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/host
git commit -m "feat(web): add host dispute queue and paper-mode scoring tabs"
```

---

## Task 21: `/projector` — Countdown Ring, Question Display, Scoreboard, Reveal

**Files:**
- Create: `apps/web/src/projector/CountdownRing.tsx`
- Create: `apps/web/src/projector/Scoreboard.tsx`
- Modify: `apps/web/src/projector/ProjectorApp.tsx`
- Test: `apps/web/src/projector/CountdownRing.test.tsx`
- Test: `apps/web/src/projector/ProjectorApp.test.tsx`

**Interfaces:**
- Consumes: `useSessionState` (Task 19), `QuizSessionStateDto`/`TeamSummaryDto` (Task 2), `useParams` from `react-router-dom`.
- Produces: read-only `/projector/:sessionId` view — no host/team auth, protected only by the session URL being unguessable, per the Phase 1 design's stated simplification.

- [ ] **Step 1: Write the failing `CountdownRing` test, then implement it**

`apps/web/src/projector/CountdownRing.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownRing } from './CountdownRing';

describe('CountdownRing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the remaining seconds and updates as time passes', () => {
    const endsAt = new Date('2026-09-16T00:00:20.000Z').toISOString();
    render(<CountdownRing endsAt={endsAt} totalSeconds={20} />);

    expect(screen.getByRole('img', { name: '20 seconds remaining' })).toBeInTheDocument();

    vi.advanceTimersByTime(5000);
    expect(screen.getByRole('img', { name: '15 seconds remaining' })).toBeInTheDocument();
  });

  it('never shows a negative remaining time once the deadline passes', () => {
    const endsAt = new Date('2026-09-16T00:00:05.000Z').toISOString();
    render(<CountdownRing endsAt={endsAt} totalSeconds={5} />);

    vi.advanceTimersByTime(10_000);
    expect(screen.getByRole('img', { name: '0 seconds remaining' })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- CountdownRing`
Expected: FAIL, then implement:

`apps/web/src/projector/CountdownRing.tsx`:
```tsx
import { useEffect, useState } from 'react';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownRing({ endsAt, totalSeconds }: { endsAt: string; totalSeconds: number }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(endsAt).getTime() - Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000))) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <svg
      width={140}
      height={140}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${remainingSeconds} seconds remaining`}
    >
      <circle cx={60} cy={60} r={RADIUS} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={60}
        cy={60}
        r={RADIUS}
        fill="none"
        stroke="#facc15"
        strokeWidth={8}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x={60} y={68} textAnchor="middle" fontSize={28} fill="white">
        {remainingSeconds}
      </text>
    </svg>
  );
}
```

Run: `pnpm --filter web test -- CountdownRing`
Expected: PASS

- [ ] **Step 2: Write the `Scoreboard` component**

`apps/web/src/projector/Scoreboard.tsx`:
```tsx
import { TeamSummaryDto } from '@quizicius/shared-types';

export function Scoreboard({ teams }: { teams: TeamSummaryDto[] }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <ol className="mx-auto mt-8 max-w-xl space-y-2" data-testid="scoreboard">
      {ranked.map((team, index) => (
        <li key={team.id} className="flex items-center justify-between rounded bg-slate-900 px-6 py-3 text-2xl">
          <span>
            #{index + 1} {team.name}
          </span>
          <span className="font-bold text-yellow-400">{team.score}</span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Write the failing `ProjectorApp` test, then implement it**

`apps/web/src/projector/ProjectorApp.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import ProjectorApp from './ProjectorApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

function renderAt(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/projector/${sessionId}`]}>
      <Routes>
        <Route path="/projector/:sessionId" element={<ProjectorApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectorApp', () => {
  it('shows a waiting message before the session loads', () => {
    (apiGet as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderAt('s1');
    expect(screen.getByText('Waiting for session…')).toBeInTheDocument();
  });

  it('shows the countdown ring and prompt during QUESTION_ACTIVE', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'QUESTION_ACTIVE',
      currentQuestion: {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'Capital of France?',
        options: [{ id: 'a', label: 'Paris' }, { id: 'b', label: 'Lyon' }],
        points: 5,
        timeLimitSeconds: 20,
        orderIndex: 0,
        correctOptionId: null,
        correctNumeric: null,
        acceptedAnswers: null,
      },
      questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
      teams: [],
    });

    renderAt('s1');
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /seconds remaining/ })).toBeInTheDocument();
  });

  it('reveals the correct option label during QUESTION_REVEAL', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'QUESTION_REVEAL',
      currentQuestion: {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'Capital of France?',
        options: [{ id: 'a', label: 'Paris' }, { id: 'b', label: 'Lyon' }],
        points: 5,
        timeLimitSeconds: 20,
        orderIndex: 0,
        correctOptionId: 'a',
        correctNumeric: null,
        acceptedAnswers: null,
      },
      questionEndsAt: null,
      teams: [],
    });

    renderAt('s1');
    expect(await screen.findByTestId('reveal-banner')).toHaveTextContent('Paris');
  });

  it('shows the scoreboard sorted by score while FINISHED', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'FINISHED',
      currentQuestion: null,
      questionEndsAt: null,
      teams: [
        { id: 't1', name: 'Low Scorers', isActive: true, score: 2, infractionCount: 0 },
        { id: 't2', name: 'High Scorers', isActive: true, score: 9, infractionCount: 0 },
      ],
    });

    renderAt('s1');
    const scoreboard = await screen.findByTestId('scoreboard');
    const teamNames = scoreboard.querySelectorAll('li');
    expect(teamNames[0]).toHaveTextContent('High Scorers');
    expect(teamNames[1]).toHaveTextContent('Low Scorers');
  });
});
```

Run: `pnpm --filter web test -- ProjectorApp`
Expected: FAIL, then implement:

`apps/web/src/projector/ProjectorApp.tsx`:
```tsx
import { useParams } from 'react-router-dom';
import { useSessionState } from '../lib/use-session-state';
import { CountdownRing } from './CountdownRing';
import { Scoreboard } from './Scoreboard';

export default function ProjectorApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { state } = useSessionState(sessionId);

  if (!state) {
    return (
      <div
        data-testid="projector-app"
        className="flex min-h-screen items-center justify-center bg-slate-950 text-2xl text-white"
      >
        Waiting for session…
      </div>
    );
  }

  const correctOption = state.currentQuestion?.options?.find(
    (option) => option.id === state.currentQuestion?.correctOptionId,
  );
  const correctAnswerText =
    correctOption?.label ??
    state.currentQuestion?.correctNumeric ??
    state.currentQuestion?.acceptedAnswers?.[0] ??
    '';

  return (
    <div data-testid="projector-app" className="min-h-screen bg-slate-950 p-8 text-white">
      <p className="text-sm uppercase tracking-widest text-slate-400">Join code: {state.joinCode}</p>

      {state.status === 'QUESTION_ACTIVE' && state.currentQuestion && state.questionEndsAt && (
        <div className="mt-8 flex flex-col items-center gap-6">
          <CountdownRing endsAt={state.questionEndsAt} totalSeconds={state.currentQuestion.timeLimitSeconds} />
          <h1 className="text-center text-5xl font-bold">{state.currentQuestion.prompt}</h1>
        </div>
      )}

      {state.status === 'QUESTION_REVEAL' && state.currentQuestion && (
        <div className="mt-8 text-center" data-testid="reveal-banner">
          <h1 className="text-5xl font-bold">{state.currentQuestion.prompt}</h1>
          <p className="mt-4 text-3xl text-emerald-400">Correct answer: {correctAnswerText}</p>
        </div>
      )}

      {(state.status === 'LOBBY' || state.status === 'PAUSE_BREAK' || state.status === 'FINISHED') && (
        <Scoreboard teams={state.teams} />
      )}
    </div>
  );
}
```

Run: `pnpm --filter web test -- ProjectorApp`
Expected: PASS (4 tests)

- [ ] **Step 4: Run the full web suite and commit**

Run: `pnpm --filter web test`
Expected: PASS — full suite green.

```bash
git add apps/web/src/projector
git commit -m "feat(web): build /projector countdown ring, question display, reveal, and scoreboard"
```

---

## Task 22: `/play` — Join Screen, Tap-to-Lock-In, Question Renderer, Reveal

**Files:**
- Create: `apps/web/src/play/JoinScreen.tsx`
- Create: `apps/web/src/play/QuestionScreen.tsx`
- Modify: `apps/web/src/play/PlayApp.tsx`
- Test: `apps/web/src/play/JoinScreen.test.tsx`
- Test: `apps/web/src/play/QuestionScreen.test.tsx`
- Test: `apps/web/src/play/PlayApp.test.tsx`

**Interfaces:**
- Consumes: `apiPost` (Task 16), `useSessionState` (Task 19), `useQuizSecurity` (Task 17, as modified above), `QuizSessionStateDto` (Task 2).
- Produces: the complete `/play/:sessionId?` route — join flow persists `{ sessionId, teamId, token }` to `localStorage` keyed by session so a reload doesn't force rejoining; the question renderer branches on `question.type` (`MULTIPLE_CHOICE` buttons, `FREE_TEXT` input, `NUMERIC_NEAREST` number input); the `LOCK_IN_ROUND` screen is a full-screen tappable overlay wired to `requestFullscreenNow`.

- [ ] **Step 1: Write the failing `JoinScreen` test, then implement it**

`apps/web/src/play/JoinScreen.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiPost } from '../lib/api-client';
import { JoinScreen } from './JoinScreen';

vi.mock('../lib/api-client', () => ({ apiPost: vi.fn() }));

describe('JoinScreen', () => {
  it('joins a session and reports the team credentials', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: 't1', name: 'The Quizzards', token: 'team-token' });
    const onJoined = vi.fn();

    render(<JoinScreen initialSessionId="s1" onJoined={onJoined} />);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await screen.findByRole('button', { name: 'Join' }); // let the submit handler settle
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/join', { name: 'The Quizzards' });
    expect(onJoined).toHaveBeenCalledWith({ sessionId: 's1', teamId: 't1', token: 'team-token' });
  });

  it('shows an error message when joining fails', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('This quiz has finished'));

    render(<JoinScreen initialSessionId="s1" onJoined={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('This quiz has finished')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- JoinScreen`
Expected: FAIL, then implement:

`apps/web/src/play/JoinScreen.tsx`:
```tsx
import { FormEvent, useState } from 'react';
import { apiPost } from '../lib/api-client';

export interface JoinResult {
  sessionId: string;
  teamId: string;
  token: string;
}

export function JoinScreen({
  initialSessionId,
  onJoined,
}: {
  initialSessionId?: string;
  onJoined: (result: JoinResult) => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ teamId: string; name: string; token: string }>(
        `/sessions/${sessionId}/teams/join`,
        { name },
      );
      onJoined({ sessionId, teamId: result.teamId, token: result.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Join the quiz</h1>
      <input
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
        placeholder="Session ID"
        className="rounded border px-3 py-2"
        required
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        className="rounded border px-3 py-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white">
        {submitting ? 'Joining…' : 'Join'}
      </button>
    </form>
  );
}
```

Run: `pnpm --filter web test -- JoinScreen`
Expected: PASS

- [ ] **Step 2: Write the failing `QuestionScreen` test, then implement it**

`apps/web/src/play/QuestionScreen.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizSessionStateDto } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';
import { QuestionScreen } from './QuestionScreen';

vi.mock('../lib/api-client', () => ({ apiPost: vi.fn() }));

const MC_STATE: QuizSessionStateDto = {
  id: 's1',
  joinCode: 'AB12',
  status: 'QUESTION_ACTIVE',
  currentQuestion: {
    id: 'q1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Capital of France?',
    options: [
      { id: 'a', label: 'Paris' },
      { id: 'b', label: 'Lyon' },
    ],
    points: 5,
    timeLimitSeconds: 20,
    orderIndex: 0,
    correctOptionId: null,
    correctNumeric: null,
    acceptedAnswers: null,
  },
  questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
  teams: [],
};

describe('QuestionScreen', () => {
  it('submits the selected option for a multiple-choice question', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<QuestionScreen state={MC_STATE} teamId="t1" token="team-token" onTapToLockIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Paris' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/answers',
      { questionId: 'q1', response: { optionId: 'a' } },
      'team-token',
    );
    expect(await screen.findByText('Answer locked in!')).toBeInTheDocument();
  });

  it('calls onTapToLockIn when the LOCK_IN_ROUND overlay is tapped', () => {
    const onTapToLockIn = vi.fn();
    render(
      <QuestionScreen state={{ ...MC_STATE, status: 'LOCK_IN_ROUND' }} teamId="t1" token="team-token" onTapToLockIn={onTapToLockIn} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tap to Lock In' }));
    expect(onTapToLockIn).toHaveBeenCalled();
  });

  it('shows the correct answer during QUESTION_REVEAL', () => {
    render(
      <QuestionScreen
        state={{ ...MC_STATE, status: 'QUESTION_REVEAL', currentQuestion: { ...MC_STATE.currentQuestion!, correctOptionId: 'a' } }}
        teamId="t1"
        token="team-token"
        onTapToLockIn={vi.fn()}
      />,
    );

    expect(screen.getByText(/Correct answer: Paris/)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- QuestionScreen`
Expected: FAIL, then implement:

`apps/web/src/play/QuestionScreen.tsx`:
```tsx
import { QuizSessionStateDto } from '@quizicius/shared-types';
import { FormEvent, useState } from 'react';
import { apiPost } from '../lib/api-client';

export function QuestionScreen({
  state,
  teamId,
  token,
  onTapToLockIn,
}: {
  state: QuizSessionStateDto;
  teamId: string;
  token: string;
  onTapToLockIn: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [text, setText] = useState('');
  const [numericValue, setNumericValue] = useState('');
  void teamId; // the team is identified server-side by the bearer token, not this prop

  async function submit(response: Record<string, unknown>): Promise<void> {
    if (!state.currentQuestion) return;
    await apiPost(`/sessions/${state.id}/answers`, { questionId: state.currentQuestion.id, response }, token);
    setSubmitted(true);
  }

  if (state.status === 'LOBBY') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">Waiting for the quiz to start…</div>
    );
  }

  if (state.status === 'LOCK_IN_ROUND') {
    return (
      <button
        onClick={onTapToLockIn}
        className="flex min-h-screen w-full items-center justify-center bg-slate-900 text-3xl font-bold text-white"
      >
        Tap to Lock In
      </button>
    );
  }

  if (state.status === 'QUESTION_ACTIVE' && state.currentQuestion) {
    if (submitted) {
      return <div className="flex min-h-screen items-center justify-center text-xl">Answer locked in!</div>;
    }

    const question = state.currentQuestion;

    if (question.type === 'MULTIPLE_CHOICE') {
      return (
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
          <div className="flex flex-col gap-3">
            {question.options?.map((option) => (
              <button
                key={option.id}
                onClick={() => submit({ optionId: option.id })}
                className="rounded border-2 border-slate-900 px-4 py-3 text-left text-lg"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === 'FREE_TEXT') {
      return (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submit({ text });
          }}
          className="mx-auto max-w-md p-6"
        >
          <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
          <input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border px-3 py-2" />
          <button type="submit" className="mt-4 w-full rounded bg-slate-900 px-4 py-3 text-white">
            Submit
          </button>
        </form>
      );
    }

    return (
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          submit({ value: Number(numericValue) });
        }}
        className="mx-auto max-w-md p-6"
      >
        <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
        <input
          type="number"
          value={numericValue}
          onChange={(e) => setNumericValue(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="mt-4 w-full rounded bg-slate-900 px-4 py-3 text-white">
          Submit
        </button>
      </form>
    );
  }

  if (state.status === 'QUESTION_REVEAL' && state.currentQuestion) {
    const correctOption = state.currentQuestion.options?.find(
      (option) => option.id === state.currentQuestion?.correctOptionId,
    );
    const answerText =
      correctOption?.label ??
      state.currentQuestion.correctNumeric ??
      state.currentQuestion.acceptedAnswers?.[0] ??
      '';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{state.currentQuestion.prompt}</h1>
        <p className="text-xl text-emerald-600">Correct answer: {answerText}</p>
      </div>
    );
  }

  return <div className="flex min-h-screen items-center justify-center text-xl">Standby…</div>;
}
```

Run: `pnpm --filter web test -- QuestionScreen`
Expected: PASS

- [ ] **Step 3: Wire up `PlayApp`**

`apps/web/src/play/PlayApp.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PlayApp from './PlayApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('PlayApp', () => {
  it('shows the join screen when no team is stored for this session', () => {
    render(
      <MemoryRouter initialEntries={['/play/s1']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayApp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Join the quiz' })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- PlayApp`
Expected: FAIL (`PlayApp` is still the Task 16 stub), then implement:

`apps/web/src/play/PlayApp.tsx`:
```tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useSessionState } from '../lib/use-session-state';
import { useQuizSecurity } from './use-quiz-security';
import { JoinScreen, JoinResult } from './JoinScreen';
import { QuestionScreen } from './QuestionScreen';

const STORAGE_PREFIX = 'quizicius:team:';

function loadStoredJoin(sessionId: string | undefined): JoinResult | null {
  if (!sessionId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    return raw ? (JSON.parse(raw) as JoinResult) : null;
  } catch {
    return null;
  }
}

export default function PlayApp() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [joined, setJoined] = useState<JoinResult | null>(() => loadStoredJoin(sessionId));

  const { state } = useSessionState(joined?.sessionId);
  const { requestFullscreenNow } = useQuizSecurity(state?.status ?? 'LOBBY', joined?.token ?? null);

  function handleJoined(result: JoinResult): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${result.sessionId}`, JSON.stringify(result));
    } catch {
      // Best-effort persistence — gameplay still works for this tab even if storage is blocked.
    }
    setJoined(result);
  }

  if (!joined) {
    return (
      <div data-testid="play-app">
        <JoinScreen initialSessionId={sessionId} onJoined={handleJoined} />
      </div>
    );
  }

  if (!state) {
    return <div data-testid="play-app">Loading…</div>;
  }

  return (
    <div data-testid="play-app">
      <QuestionScreen state={state} teamId={joined.teamId} token={joined.token} onTapToLockIn={requestFullscreenNow} />
    </div>
  );
}
```

Run: `pnpm --filter web test -- PlayApp`
Expected: PASS

- [ ] **Step 4: Run the full web suite, then the full monorepo suite, and commit**

Run: `pnpm --filter web test`
Expected: PASS — full web suite green.

Run: `pnpm -r test`
Expected: PASS — every test across `shared-types`, `api`, and `web`.

```bash
git add apps/web/src/play
git commit -m "feat(web): build /play join flow, tap-to-lock-in, question renderer, and reveal"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every Phase 1 section of the design doc maps to a task — schema (3), config/auth (4–5), state machine (6), grading (7), data layer (8), team identity (9), realtime (10), engine orchestration (11), teams/answers/infractions endpoints (12–14), quizzes/questions/sessions controllers + integration test (15), paper-mode backend (18), frontend scaffold/PWA (16), anti-cheat hook incl. the Fullscreen-gesture correction (17), host views (19–20), projector (21), play (22).
- **Gaps found and closed during writing, not left as follow-ups:** team-token revocation on rejoin required a device-hash check in the guard, not just JWT verification (Task 9); hiding the correct answer pre-reveal required extending the shared DTO and `getState` (Tasks 2, 11, 13); paper-mode scoring had no backend surface at all in the original task list (Task 18); the dispute queue needed a list endpoint that wasn't specified (Task 20); Fullscreen requires a user gesture, so the anti-cheat hook needed a manual trigger for the tap-to-lock-in overlay (Task 17, revisited before Task 22).
- **Known, intentional Phase 1 simplifications** (not gaps — see the design doc's "Out of Scope" section): no reconnection/resync beyond REST rehydration, no rate limiting, no device fingerprinting/trust scoring, `/play`'s session identifier is the session UUID rather than a human-typed join code (consistent with `/projector`'s existing URL-based access), and the host's "next question" control takes a raw question ID rather than a picker UI.

