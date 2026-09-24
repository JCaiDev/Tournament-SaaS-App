<div align="center">

# 🏐 SideOut

**Run pickup volleyball without the group-chat chaos.**

Hosts post games, players join or apply, and the host manages the roster, payments and teams in one place.

[![CI](https://github.com/JCaiDev/Tournament-SaaS-App/actions/workflows/ci.yml/badge.svg)](https://github.com/JCaiDev/Tournament-SaaS-App/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Angular](https://img.shields.io/badge/Angular_20-DD0031?logo=angular&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)

### [🌐 Live demo](https://sideout-app.netlify.app) · [⚙️ API health](https://tournament-saas-app.onrender.com/health)

<sub>The API runs on Render's free tier and sleeps after 15 minutes idle. The first request can take 30 to 60 seconds to wake it up.</sub>

</div>

---

## ✨ Features

| For hosts | For players |
| --- | --- |
| Create, edit and delete games (location, time, skill level, gender format, price) | Browse open games |
| Open signup or approval-only rosters | Join instantly or apply to approval-only games |
| Approve players, track who has paid, add guests without accounts | Sign in with Google or email and password |
| Team maker: shuffle the roster into balanced teams and pools, then adjust by hand | Manage your own profile |

## 🏗️ Architecture

```mermaid
flowchart LR
    B([Browser]) -->|HTTPS| N[Netlify<br/>Angular SPA]
    N -->|"/api/* proxy"| R[Render<br/>Express API · Docker]
    R -->|Prisma + pg adapter| S[(Supabase<br/>PostgreSQL)]
    R -.->|BullMQ jobs| Q[(Redis)]
    Q -.-> W[Email worker]
```

The browser only ever talks to the Netlify domain. Netlify proxies `/api/*` to the API, so every request is same-origin. That keeps the `SameSite=Strict` refresh-token cookie working without loosening cookie or CORS rules. Dashed lines are background-job plumbing that is built but not yet deployed.

## 🧰 Tech stack

| Layer | Tools |
| --- | --- |
| **Frontend** | Angular 20 (standalone components, signals), TypeScript |
| **Backend** | Node.js, Express 5, TypeScript, Zod validation |
| **Database** | PostgreSQL, Prisma ORM with versioned migrations |
| **Auth** | JWT access tokens, rotating refresh tokens, Google OAuth, argon2 |
| **Jobs** | Redis + BullMQ (separate worker process) |
| **Testing** | Jest + Supertest against real Postgres and Redis |
| **Infra** | Docker, GitHub Actions, Render, Netlify, Supabase, Turborepo |

## 🔐 Auth design

Authentication is built in-house rather than handed to a provider:

- **Short-lived access tokens.** JWTs expire after 15 minutes and are sent as `Authorization: Bearer <token>`.
- **Rotating refresh tokens.** A random 64-byte token lives in an `httpOnly`, `Secure`, `SameSite=Strict` cookie. Every refresh revokes the old token and issues a new one.
- **Hashed at rest.** Refresh tokens are stored as SHA-256 hashes, so a database leak does not expose usable tokens. Passwords are hashed with argon2.
- **Two sign-in methods.** Google ID tokens are verified server-side with `google-auth-library`; email and password is the alternative.
- **Role-based access.** `requireAuth` and `requireRole(...)` middleware protect routes for `ADMIN`, `HOST` and `PLAYER` roles.
- **Silent refresh on the client.** An Angular HTTP interceptor catches a 401, refreshes once, and retries the original request.

## 🗄️ Data model

```mermaid
erDiagram
    User ||--o{ Lobby : hosts
    User ||--o{ LobbyPlayer : "joins as"
    Lobby ||--o{ LobbyPlayer : has
    User ||--o{ RefreshToken : owns

    User {
        uuid id PK
        string email UK
        string passwordHash "null for Google-only accounts"
        string googleSub UK
        enum role "ADMIN | HOST | PLAYER"
    }
    Lobby {
        uuid id PK
        uuid hostId FK
        string lobbyName
        datetime startTime
        enum skillLevel
        enum genderFormat
        float price
        bool allowToApply
    }
    LobbyPlayer {
        uuid id PK
        uuid lobbyId FK
        uuid userId FK "null for guests"
        string guestName
        bool approved
        bool paid
    }
    RefreshToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
    }
```

## 📡 API

Requests are validated with Zod schemas before they reach a controller. The code is layered as **routes → controllers → services → Prisma**.

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/auth/google` · `/auth/login` | Public |
| `POST` | `/auth/refresh` · `/auth/logout` | Refresh cookie |
| `POST` | `/users` | Public (sign up) |
| `GET` | `/users/:id` | Signed in |
| `PATCH` `DELETE` | `/users/me` | Signed in |
| `PATCH` `DELETE` | `/users/:id` | Admin |
| `GET` | `/lobbies` · `/lobbies/:id` | Public |
| `POST` `PATCH` `DELETE` | `/lobbies` · `/lobbies/:id` | Host / Admin |
| `GET` | `/lobbies/:lobbyId/players` | Public |
| `POST` | `/lobbies/:lobbyId/players` | Host / Admin |
| `PATCH` `DELETE` | `/lobbies/:lobbyId/players/:playerId` | Host / Admin |

## 📁 Project structure

```
.
├── apps/
│   ├── api/                  # Express + Prisma backend
│   │   ├── prisma/           # schema.prisma + migrations
│   │   ├── src/
│   │   │   ├── auth/         # login, refresh, logout, Google OAuth
│   │   │   ├── user/         # user CRUD
│   │   │   ├── lobby/        # lobbies + lobby players
│   │   │   ├── middleware/   # auth, validation, errors, logging
│   │   │   ├── queues/       # BullMQ queues
│   │   │   └── workers/      # BullMQ workers (separate process)
│   │   ├── tests/            # Jest unit / integration / API tests
│   │   └── Dockerfile
│   └── web/                  # Angular frontend
│       └── src/app/
│           ├── core/         # auth guard, HTTP interceptor
│           ├── pages/        # home, login, signup, profile, lobby pages
│           └── services/     # API clients
├── packages/shared/          # code shared between apps
└── .github/workflows/ci.yml
```

## 🚀 Getting started

### Prerequisites

- Node.js 18 or later (CI uses 20)
- Docker, for local Postgres and Redis
- A Google OAuth client ID, only if you want Google sign-in

### 1. Install

```bash
git clone https://github.com/JCaiDev/Tournament-SaaS-App.git
cd Tournament-SaaS-App
npm install
```

### 2. Start Postgres and Redis

```bash
docker compose -f apps/api/docker-compose.yml up -d postgres
docker run -d --name redis -p 6379:6379 redis   # needed for tests and the worker
```

### 3. Configure the API

Create `apps/api/.env`. The API refuses to start if any of these are missing:

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/test_db
JWT_SECRET=change-me
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGIN=http://localhost:4200
```

### 4. Migrate and run

```bash
cd apps/api
npx prisma migrate deploy
cd ../..
npm run dev          # API on :3001, web app on :4200
```

## 🧪 Testing

The backend tests run against a **real** Postgres and Redis, not mocks. They are split into unit, integration and API tests for each module.

```bash
cd apps/api
npm run db:test:push   # sync the test database schema (reads .env.test)
npm test
```

GitHub Actions runs the whole suite on every pull request, with Postgres and Redis as service containers. `main` is protected, so a change merges only through a pull request with green CI.

## ☁️ Deployment

| Piece | Where | How |
| --- | --- | --- |
| Frontend | Netlify | Builds `apps/web` on merge to `main` (see `apps/web/netlify.toml`) |
| API | Render | Builds `apps/api/Dockerfile` from the repo root on merge to `main` |
| Database | Supabase | Managed Postgres only. The pooled connection serves the app; the direct connection runs `prisma migrate deploy` |

Build the API image locally:

```bash
docker build -t tournament-api -f apps/api/Dockerfile .
docker run --rm -p 3002:3001 --env-file apps/api/.env tournament-api
```

## 🗺️ Roadmap

- [x] Lobbies, rosters, approvals and payment tracking
- [x] Google + email auth with rotating refresh tokens
- [x] Dockerized API, CI, and production deploy
- [ ] Save teams and pools to the database
- [ ] Admin endpoint for role changes
- [ ] Welcome emails through the BullMQ worker
- [ ] Rate limiting on auth routes
- [ ] **Tournaments:** pool play, round-robin scheduling, score entry, live standings and playoff brackets
- [ ] Live updates with server-sent events and Redis pub/sub

## 📄 License

[MIT](LICENSE)
