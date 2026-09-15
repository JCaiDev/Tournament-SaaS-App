# Tournament-SaaS-App

A volleyball/pickup-game lobby SaaS. Hosts create "lobbies" (games), players join or apply, the host manages the roster. Turborepo monorepo.

- `apps/api` — Express + TypeScript + Prisma + PostgreSQL + Redis/BullMQ
- `apps/web` — Angular (standalone components, signals)
- `packages/shared` — shared code between them

## How to work with the user on this repo

The user is using this project to become an **employable backend engineer within 3 months**. This drives a hard split in how Claude should behave depending on which app is being touched.

### `apps/web` (frontend) — code normally
Implement, edit, and write frontend code directly, same as any other project.

### `apps/api` (backend) — teach, don't implement
The user wants to type every line of backend code themselves. **Do not write backend implementation code** unless they explicitly override this for a specific request (e.g. "just write it," "show me the code"). Instead, follow this loop for backend tasks:

1. **Frame the task** — state what they're building and *why it matters*: what real backend concern it addresses (auth, validation, data integrity, security, concurrency, etc.), not just what feature it is.
2. **Identify components, not code** — list the pieces needed (e.g. "a middleware to verify the JWT," "a Zod schema for the request body," "a Prisma transaction so both writes are atomic") and explain why each is needed, conceptually. No code. No pseudocode that's just code with the syntax filed off.
3. **Let them attempt it** — they write the implementation. Don't preemptively fix mistakes mid-attempt unless they ask a direct clarifying question.
4. **Review their implementation** — once they say they're done or stuck, review for correctness bugs, security issues, and missing concepts (e.g. "you're not hashing the token before storing it — here's why that matters"). Call out anything that would fail a real code review or break in production.
5. **Show the production/correct version** — after reviewing, show what a senior engineer's version looks like and why it differs. Reference real prior art already in this codebase where relevant (e.g. `auth.service.ts`'s existing token rotation).
6. **Quiz them** — ask a handful of questions probing the underlying concepts, not just "did you get this file right." Calibrate toward what a backend interview or on-the-job review would probe.

This loop is the default for backend work in `apps/api`. It does not apply to read-only work (exploring, explaining existing code, answering questions) — only to building new backend functionality.

## Architecture reference

### Backend (`apps/api`)

**Layering convention**: `*.routes.ts` → `*.controller.ts` → `*.service(s).ts` → Prisma. Request validation via Zod schemas in `*.schemas.ts`, applied with `validateBody` / `validateParams` / `validateQuery` middleware (`middleware/validate.ts`).

**Modules**: `auth`, `user`, `lobby` + `lobby-player`, `health`.

**Auth model**:
- Access token: JWT, 15 min expiry, sent as `Authorization: Bearer <token>`.
- Refresh token: random 64-byte hex, SHA-256 hashed before being stored in the `RefreshToken` table, delivered via an httpOnly/secure/`sameSite=strict` cookie, rotated (old one revoked, new one issued) on every `POST /auth/refresh`.
- Login methods: Google OAuth (`google-auth-library`, verified against `GOOGLE_CLIENT_ID`) and email/password (argon2 hashing).
- `requireAuth` / `requireRole(...roles)` middleware in `middleware/auth.middleware.ts`. `Role` enum: `ADMIN`, `HOST`, `PLAYER`.

**Data model** (`prisma/schema.prisma`): `User`, `Lobby` (hosted by a `User`), `LobbyPlayer` (join table: `approved`, `paid`, `position`), `RefreshToken`.

**Background jobs**: BullMQ `queues/email.queue.ts` + `workers/email.worker.ts` — currently a stub (logs instead of sending) and **not yet invoked** from signup. The worker is a separate process (`npm run worker`), not started by `server.ts`.

**Env validation**: `config/env.ts` throws at startup if `NODE_ENV`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, or `JWT_SECRET` are missing.

**Testing**: Jest, `tests/` mirrors the module structure (api/int/unit tests per feature), run against real Postgres + Redis (see `docker-compose.yml` and CI).

### Frontend (`apps/web`)

- Standalone Angular components, signals for state (e.g. `AuthService.currentUser`).
- `core/auth.guard.ts` — route protection (redirects to `/login` if not signed in).
- `core/auth.interceptor.ts` — attaches the Bearer token to outgoing requests.
- `services/auth.service.ts`, `services/lobby.service.ts` — talk to the API via `environment.apiBaseUrl`.
- `shared/mock/mock-lobby.api.ts` — dev-only in-memory backend, toggled by `environment.mockApi` (currently `false` — expects the real API to be running).
- Pages: home, login, signup, profile, create-lobby, edit-lobby, lobby-detail.

## Known in-progress gaps

Don't assume these are finished — they're identified but not yet fixed:

- No frontend silent-refresh flow: nothing catches a 401 and calls `/auth/refresh` before retrying, so users get logged out ~15 min after login with no warning.
- CORS origin is hardcoded to `http://localhost:4200` in `app.ts` — will break once deployed.
- Redis connection is hardcoded to `127.0.0.1:6379` in both `email.queue.ts` and `email.worker.ts` — not env-configurable, will break in any real deployment topology.
- No production Dockerfile/build for `apps/web`; the existing `docker-compose.yml` is dev-only (default Postgres creds, `prisma migrate dev`).
- Signup doesn't enqueue the welcome email even though the BullMQ plumbing exists.
- No password reset or email verification flow.
- `Lobby.price` / `LobbyPlayer.paid` exist in the schema with no payment integration — `paid` appears to be host-toggled manually. Unconfirmed whether that's the intended v1 design or a gap.

## Dev commands (`apps/api`)

```
npm run dev          # start API with ts-node-dev
npm run worker        # start the BullMQ email worker (separate process)
npm run test          # Jest against .env.test
npm run test:ci       # Jest without dotenv (CI uses real env vars)
npm run db:push       # prisma db push (dev DB)
npm run db:test:push  # prisma db push (test DB)
npm run build         # prisma generate + tsc
npm run typecheck     # tsc --noEmit
```
