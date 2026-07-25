# AI Skin Analysis Platform

A production-grade AI-powered skin analysis and product recommendation platform for Indian users. Users capture their face via camera, the AI analyzes skin type and conditions, a lifestyle questionnaire adds contextual data, and the system recommends dermatologist-approved products from **Nykaa**, **Minimalist**, and **Dermaco**, **Nykaa**.

---

## Architecture Overview

```
skin-analysis-platform/
├── apps/
│   ├── web/          Next.js 14 (App Router) — frontend
│   └── api/          FastAPI (Python 3.11) — backend
├── packages/
│   └── shared-types/ Shared TypeScript types
├── infrastructure/   Docker Compose + Nginx configs
└── docs/             Architecture, API, and privacy docs
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full data-flow diagram.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20.x |
| pnpm | ≥ 9.x |
| Python | 3.11.x |
| Docker | ≥ 26.x |
| Docker Compose | ≥ 2.x |

---

## Quick Start (Development)

### 1. Clone & install

```bash
git clone <repo-url> skin-analysis-platform
cd skin-analysis-platform

# Install JS deps (monorepo via pnpm workspaces)
pnpm install

# Install Python deps
cd apps/api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 2. Configure environment

```bash
cp .env.example .env.local
cp .env.local.example apps/web/.env.local
```

Fill in **all required secrets** (see `.env.example` for documentation on each variable).

### 3. Start infrastructure (Postgres + Redis)

```bash
cd infrastructure
docker compose up postgres redis -d
cd ..
```

### 4. Run database migrations

```bash
cd apps/api
alembic upgrade head
cd ../..
```

### 5. Start development servers

```bash
# Option A — Turborepo (runs all apps in parallel)
pnpm dev

# Option B — individual
pnpm --filter @skin-analysis/web dev      # http://localhost:3100
pnpm --filter @skin-analysis/api dev      # http://localhost:8000
```

### 6. Full Docker stack

```bash
cd infrastructure
docker compose up --build
```

Nginx reverse-proxies everything through `http://localhost:80`.

---

## Useful Commands

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Unit tests
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Python tests
cd apps/api && pytest

# Generate new DB migration
cd apps/api && alembic revision --autogenerate -m "description"
```

---

## Stakeholder Roles

| Role | Access |
|------|--------|
| **User** | Camera scan, questionnaire, results, roadmap, progress |
| **Dermatologist** | Review queue, case approval/rejection |
| **Admin** | Full platform control, product management, analytics |

---

## Image Privacy

All captured face images are:
1. EXIF-stripped server-side via **Sharp** before storage
2. Stored as presigned S3 URLs expiring in **60 seconds**
3. Face-blurred after analysis completion
4. **Permanently deleted** from S3 within 60 seconds via lifecycle policy

See [docs/DATA_PRIVACY.md](docs/DATA_PRIVACY.md) for full compliance details.

---

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0
- **AI/ML**: TensorFlow.js (in-browser), scikit-learn + OpenCV (server), Claude API (recommendations)
- **Databases**: PostgreSQL 15, Redis 7, Pinecone (vectors)
- **Auth**: NextAuth.js v5 (JWT + refresh token rotation)
- **Storage**: AWS S3 (ephemeral — Mumbai region)
- **Deployment**: Docker Compose (dev), Vercel (frontend), Railway/Render (backend)
- **Testing**: Vitest, Pytest, Playwright
- **Monitoring**: Sentry, PostHog

---

## Documentation

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Data Privacy & Compliance](docs/DATA_PRIVACY.md)
