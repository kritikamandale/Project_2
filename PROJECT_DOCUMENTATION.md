# AI Skin Analysis Platform — Complete Project Reference

> **Project:** SkinAI — AI-powered skin analysis and dermatologist-approved product recommendation platform for Indian users
> **Architecture:** Full-stack monorepo (Next.js 14 + FastAPI + PostgreSQL + Redis)
> **Status:** Phase 10 — Security Hardening & Production Deployment

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Complete Directory Structure](#2-complete-directory-structure)
3. [Naming Conventions](#3-naming-conventions)
4. [Tech Stack](#4-tech-stack)
5. [Root Configuration](#5-root-configuration)
6. [Frontend (Next.js) Configuration](#6-frontend-nextjs-configuration)
7. [Backend (FastAPI) Configuration](#7-backend-fastapi-configuration)
8. [Environment Variables](#8-environment-variables)
9. [Database Schema](#9-database-schema)
10. [API Architecture](#10-api-architecture)
11. [Shared Types (TypeScript)](#11-shared-types-typescript)
12. [Key Features & Workflows](#12-key-features--workflows)
13. [Security Architecture](#13-security-architecture)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment & Infrastructure](#15-deployment--infrastructure)
16. [Dependencies Summary](#16-dependencies-summary)
17. [CI/CD Pipelines](#17-cicd-pipelines)
18. [Secrets Rotation Schedule](#18-secrets-rotation-schedule)
19. [Quick Reference: Key Paths](#19-quick-reference-key-paths)

---

## 1. Project Overview

| Field | Value |
|---|---|
| Project Name | AI Skin Analysis Platform (SkinAI) |
| Version | 0.1.0 |
| Package Manager | pnpm 9.12.3 |
| Build System | Turborepo 2.3.1 |
| Architecture | Monorepo (apps + packages) |
| Target Market | India (ap-south-1 / Mumbai AWS region) |
| Languages | TypeScript (frontend), Python 3.11 (backend) |
| Node Version | ≥20 |
| Python Version | 3.11 |
| Development Phase | Phase 10 — Security Hardening |

**Core Value Proposition:**
- In-browser TensorFlow.js skin analysis (face images never leave the device)
- Claude AI-powered personalized skincare recommendations
- Products sourced from Indian brands: Nykaa, Minimalist, Dermaco
- Optional dermatologist review queue
- 8-week progress tracking roadmap
- GDPR-compliant, privacy-first architecture

---

## 2. Complete Directory Structure

```
skin-analysis-platform/                    # Monorepo root
│
├── .git/                                  # Git repository
├── .gitignore                             # Excludes: node_modules, .venv, .env,
│                                          #   .next, __pycache__, build artifacts
├── .turbo/                                # Turborepo task cache
│
├── package.json                           # Root monorepo config (pnpm workspaces)
├── package-lock.json                      # npm lock (legacy)
├── pnpm-lock.yaml                         # pnpm workspace lock (primary)
├── tsconfig.json                          # Root TypeScript config
│
├── .env.example                           # Root/FastAPI env template
├── .env.local.example                     # Next.js env template
│
├── README.md                              # Main project documentation
│
├── apps/                                  # Deployable applications
│   │
│   ├── api/                               # FastAPI backend (Python 3.11)
│   │   ├── app/                           # Application source
│   │   │   ├── main.py                    # FastAPI app entry point
│   │   │   │                              #   - Sentry init, middleware stack,
│   │   │   │                              #   - 9 routers, health check
│   │   │   ├── core/                      # App-wide infrastructure
│   │   │   │   ├── config.py              # Pydantic Settings (all env vars)
│   │   │   │   ├── security.py            # JWT, bcrypt, token hashing utilities
│   │   │   │   ├── database.py            # SQLAlchemy async engine & session
│   │   │   │   ├── dependencies.py        # FastAPI dependency injectors
│   │   │   │   └── limiter.py             # slowapi rate limiter setup
│   │   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   │   ├── base.py                # Base class, UUIDMixin, TimestampMixin,
│   │   │   │   │                          #   SoftDeleteMixin
│   │   │   │   ├── user.py                # User, UserProfile, RefreshToken,
│   │   │   │   │                          #   AuditLog; Enums: UserRole, FitzpatrickScale
│   │   │   │   ├── scan.py                # SkinScan, SkinCondition
│   │   │   │   │                          #   Enums: SkinType, ConditionName,
│   │   │   │   │                          #   Severity, AffectedZone
│   │   │   │   ├── questionnaire.py       # QuestionnaireResponse
│   │   │   │   ├── recommendation.py      # Recommendation, RecommendationProduct
│   │   │   │   ├── product.py             # Product, ProductEmbedding
│   │   │   │   ├── progress.py            # ProgressScan, RoutineCheckin
│   │   │   │   └── admin.py               # Admin / analytics models
│   │   │   ├── schemas/                   # Pydantic v2 request/response schemas
│   │   │   │   ├── user.py
│   │   │   │   ├── scan.py
│   │   │   │   ├── questionnaire.py
│   │   │   │   ├── recommendation.py
│   │   │   │   ├── product.py
│   │   │   │   ├── progress.py
│   │   │   │   └── dermatologist.py
│   │   │   ├── routers/                   # API endpoint handlers (one file per domain)
│   │   │   │   ├── auth.py                # /auth — register, login, refresh,
│   │   │   │   │                          #   logout, forgot/reset password,
│   │   │   │   │                          #   email verification
│   │   │   │   ├── users.py               # /users — profile CRUD, account deletion
│   │   │   │   ├── scan.py                # /scan — submit vector, history, detail
│   │   │   │   ├── questionnaire.py       # /questionnaire — lifestyle questions
│   │   │   │   ├── recommendations.py     # /recommendations — generate via Claude,
│   │   │   │   │                          #   retrieve, feedback, roadmap
│   │   │   │   ├── products.py            # /products — catalog, search, filters
│   │   │   │   ├── progress.py            # /progress — 8-week progress tracking
│   │   │   │   ├── dermatologist.py       # /dermatologist — review queue,
│   │   │   │   │                          #   case approval/modification
│   │   │   │   └── privacy.py             # /privacy — GDPR export & deletion
│   │   │   ├── services/                  # Business logic layer (pure Python)
│   │   │   │   ├── auth_service.py
│   │   │   │   ├── skin_analysis.py
│   │   │   │   ├── recommendation.py      # Claude API integration
│   │   │   │   ├── dermatologist.py
│   │   │   │   ├── admin_service.py
│   │   │   │   ├── image_processor.py     # EXIF strip, resize, blur
│   │   │   │   ├── email_service.py       # Resend (email) integration
│   │   │   │   ├── climate_service.py     # Open-Meteo API
│   │   │   │   ├── roadmap.py             # 8-week routine generation
│   │   │   │   ├── notification.py
│   │   │   │   └── clamav.py              # Malware scanning (ClamAV)
│   │   │   └── ml/                        # Server-side ML inference code
│   │   ├── alembic/                       # Database migrations
│   │   │   ├── versions/
│   │   │   │   ├── 0001_initial_schema.py      # Users, scans, products,
│   │   │   │   │                               #   recommendations
│   │   │   │   ├── 0002_progress_phase7.py     # Progress tracking tables
│   │   │   │   ├── 0003_dermatologist_phase8.py
│   │   │   │   ├── 0004_admin_phase9.py
│   │   │   │   ├── 0005_rls_phase10.py         # Row-Level Security (RLS)
│   │   │   │   ├── 0006_lifestyle_section8.py
│   │   │   │   ├── 0007_missing_columns.py
│   │   │   │   └── 0008_phase_6_columns.py
│   │   │   └── env.py                     # Alembic migration config script
│   │   ├── tests/                         # Pytest test suite
│   │   ├── .env                           # Local dev secrets (git-ignored)
│   │   ├── .env.example                   # Env var template
│   │   ├── alembic.ini                    # Alembic configuration
│   │   ├── Dockerfile                     # Multi-stage production Docker image
│   │   ├── pytest.ini                     # Pytest configuration
│   │   └── requirements.txt               # Python dependencies (46 packages)
│   │
│   └── web/                               # Next.js 14 frontend (TypeScript)
│       ├── app/                           # Next.js App Router
│       │   ├── layout.tsx                 # Root layout — fonts, providers,
│       │   │                              #   metadata, viewport
│       │   ├── page.tsx                   # Landing page (/)
│       │   ├── globals.css                # Global Tailwind CSS
│       │   ├── globals/                   # Global-scope components
│       │   ├── (auth)/                    # Route group — unauthenticated pages
│       │   │   ├── login/page.tsx
│       │   │   ├── register/page.tsx
│       │   │   ├── forgot-password/page.tsx
│       │   │   ├── reset-password/page.tsx
│       │   │   └── verify-email/page.tsx
│       │   ├── (user)/                    # Route group — protected user pages
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── scan/page.tsx          # Camera + TF.js skin analysis
│       │   │   ├── questionnaire/page.tsx
│       │   │   ├── results/page.tsx
│       │   │   ├── roadmap/page.tsx       # 8-week routine
│       │   │   ├── progress/page.tsx
│       │   │   └── profile/page.tsx
│       │   ├── (dermatologist)/           # Route group — derm-only pages
│       │   │   ├── derm-dashboard/page.tsx
│       │   │   ├── review-queue/page.tsx
│       │   │   └── case/[id]/page.tsx     # Dynamic case review
│       │   ├── (public)/                  # Route group — public info pages
│       │   │   ├── privacy/page.tsx
│       │   │   └── terms/page.tsx
│       │   └── api/                       # Next.js API routes (proxy layer)
│       │       ├── auth/[...nextauth]/route.ts    # NextAuth.js v5 callbacks
│       │       ├── csrf/route.ts                   # CSRF token endpoint
│       │       └── proxy/[...slug]/route.ts        # FastAPI reverse proxy
│       ├── components/                    # Reusable React components
│       │   ├── auth/                      # Login / register / auth form components
│       │   ├── camera/                    # TensorFlow.js camera & real-time ML UI
│       │   ├── questionnaire/             # Lifestyle questionnaire form
│       │   ├── results/                   # Scan results & product recommendations
│       │   ├── progress/                  # Progress tracking, timeline, charts
│       │   ├── shared/                    # Layout, navigation, providers, toaster
│       │   ├── ui/                        # shadcn/ui component library (Radix UI)
│       │   └── admin/                     # Admin dashboard components
│       ├── lib/                           # Utility functions & configs
│       │   ├── auth.ts                    # NextAuth v5 config
│       │   │                              #   (JWT callbacks, session, refresh)
│       │   ├── csrf.ts                    # CSRF protection helpers
│       │   └── mockStore.ts               # Zustand store utilities
│       ├── middleware.ts                  # Route protection middleware
│       │                                  #   (role-based, header injection)
│       ├── public/                        # Static assets
│       │   └── models/                    # TensorFlow.js model files (.json/.bin)
│       ├── __tests__/                     # Vitest unit tests
│       ├── tests/                         # Playwright E2E tests
│       ├── .next/                         # Build output (git-ignored)
│       ├── .eslintrc.json                 # ESLint configuration
│       ├── next.config.js                 # Next.js config (CSP, headers, rewrites)
│       ├── tailwind.config.ts             # Tailwind CSS config
│       ├── tsconfig.json                  # TypeScript config
│       ├── package.json                   # Frontend dependencies
│       ├── Dockerfile                     # Multi-stage production Docker image
│       ├── playwright.config.ts           # Playwright E2E config
│       └── node_modules/                  # Dependencies (git-ignored)
│
├── packages/                              # Shared monorepo packages
│   └── shared-types/                      # @skin-analysis/shared-types
│       ├── src/
│       │   └── index.ts                   # Exported TypeScript types:
│       │                                  #   User, Scan, Recommendation, etc.
│       ├── package.json
│       └── node_modules/
│
├── infrastructure/                        # Docker & infrastructure config
│   ├── docker-compose.yml                 # Dev stack: Postgres, Redis,
│   │                                      #   FastAPI, Next.js, Nginx
│   ├── docker-compose.prod.yml            # Production stack
│   ├── postgres/
│   │   └── init.sql                       # DB initialization script
│   └── nginx/
│       ├── nginx.dev.conf                 # Development Nginx config
│       └── nginx.prod.conf                # Production Nginx config
│
├── docs/                                  # Project documentation
│   ├── ARCHITECTURE.md                    # Data flow & component diagrams
│   ├── API.md                             # API endpoint reference
│   └── DATA_PRIVACY.md                    # Privacy & compliance documentation
│
└── .github/
    └── workflows/
        ├── ci.yml                         # CI: tests, lint, security scans
        └── deploy.yml                     # CD: Docker build, migrate, deploy
```

---

## 3. Naming Conventions

### 3.1 File & Directory Naming

| Scope | Convention | Examples |
|---|---|---|
| Next.js pages | `page.tsx` (App Router) | `app/(user)/dashboard/page.tsx` |
| Next.js layouts | `layout.tsx` | `app/layout.tsx` |
| Next.js API routes | `route.ts` | `app/api/csrf/route.ts` |
| React components | `PascalCase.tsx` | `SkinScanCamera.tsx`, `ResultsCard.tsx` |
| Component dirs | `kebab-case/` | `components/camera/`, `components/shared/` |
| Utility files | `camelCase.ts` | `auth.ts`, `csrf.ts`, `mockStore.ts` |
| Config files | `camelCase.config.*` | `tailwind.config.ts`, `playwright.config.ts` |
| Next.js config | `next.config.js` | (framework convention) |
| Python modules | `snake_case.py` | `skin_analysis.py`, `auth_service.py` |
| Python packages | `snake_case/` | `core/`, `routers/`, `services/` |
| SQL migrations | `NNNN_description_phaseN.py` | `0003_dermatologist_phase8.py` |
| Docker files | `Dockerfile` (no extension) | `apps/api/Dockerfile` |
| Env files | `.env`, `.env.example` | `.env.local.example` |
| CI/CD workflows | `kebab-case.yml` | `ci.yml`, `deploy.yml` |
| Documentation | `UPPER_CASE.md` | `ARCHITECTURE.md`, `DATA_PRIVACY.md` |

### 3.2 Next.js Route Group Naming

Route groups use parentheses and describe the access level:

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/login`, `/register`, etc. | Unauthenticated-only routes |
| `(user)` | `/dashboard`, `/scan`, etc. | Authenticated user routes |
| `(dermatologist)` | `/derm-dashboard`, etc. | Role-restricted to DERMATOLOGIST |
| `(public)` | `/privacy`, `/terms` | Public informational pages |

Route slugs use `kebab-case`: `/forgot-password`, `/review-queue`, `/derm-dashboard`.  
Dynamic segments use `[camelCase]`: `case/[id]/page.tsx`.

### 3.3 TypeScript Naming

| Element | Convention | Examples |
|---|---|---|
| Interfaces | `PascalCase` | `User`, `Recommendation`, `TokenPair` |
| Type aliases | `PascalCase` | `SkinType`, `UserRole`, `ProductBrand` |
| Enums | `PascalCase` (type alias) | `"USER" \| "DERMATOLOGIST"` |
| Functions | `camelCase` | `createAccessToken()`, `hashPassword()` |
| React components | `PascalCase` | `SkinScanCamera`, `ProgressTimeline` |
| Hooks | `useCamelCase` | `useAuth`, `useSkinAnalysis` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_SCANS_PER_DAY` |
| Environment vars | `UPPER_SNAKE_CASE` | `NEXTAUTH_SECRET`, `DATABASE_URL` |

### 3.4 Python Naming

| Element | Convention | Examples |
|---|---|---|
| Modules | `snake_case.py` | `auth_service.py`, `skin_analysis.py` |
| Classes | `PascalCase` | `User`, `SkinScan`, `Recommendation` |
| Functions | `snake_case()` | `create_access_token()`, `hash_password()` |
| Variables | `snake_case` | `user_id`, `skin_type` |
| Constants | `UPPER_SNAKE_CASE` | `COMMON_PASSWORDS`, `JWT_ALGORITHM` |
| Pydantic models | `PascalCase` | `UserCreate`, `ScanResponse` |
| SQLAlchemy models | `PascalCase` | `User`, `SkinScan`, `Product` |
| Enums | `PascalCase` | `UserRole`, `SkinType`, `FitzpatrickScale` |
| Alembic revisions | `NNNN_description.py` | `0001_initial_schema.py` |

### 3.5 Database Naming

| Element | Convention | Examples |
|---|---|---|
| Tables | `snake_case` (plural) | `users`, `skin_scans`, `user_profiles` |
| Columns | `snake_case` | `user_id`, `hashed_password`, `created_at` |
| Primary keys | `id` (UUID) | `id UUID DEFAULT gen_random_uuid()` |
| Foreign keys | `{table_singular}_id` | `user_id`, `scan_id` |
| Boolean flags | `is_*` or `has_*` | `is_verified`, `is_active`, `is_deleted` |
| Timestamps | `*_at` | `created_at`, `updated_at`, `deleted_at` |
| JSON fields | `*_json` | `raw_analysis_json`, `roadmap_json`, `metadata_json` |
| Indexes | `ix_{table}_{column}` | `ix_users_email` |
| Enum types | `snake_case` (PostgreSQL) | `user_role`, `skin_type`, `fitzpatrick_scale` |

### 3.6 API Endpoint Naming

All endpoints are under `/api/v1/` prefix. REST conventions:

```
GET    /api/v1/users/me               # Fetch current user
POST   /api/v1/auth/login             # Authenticate
POST   /api/v1/scan/submit            # Submit new scan
GET    /api/v1/scan/history           # List scans
GET    /api/v1/scan/{id}              # Single scan
POST   /api/v1/recommendations/generate
GET    /api/v1/recommendations/{id}/roadmap
GET    /api/v1/recommendations/{id}/products
POST   /api/v1/recommendations/{id}/feedback
```

Path params: `{kebab-case}` for multi-word, `{id}` for UUIDs.

### 3.7 Docker / Infrastructure Naming

| Element | Convention | Examples |
|---|---|---|
| Docker services | `kebab-case` | `fastapi`, `nextjs`, `postgres`, `redis` |
| Docker images | `kebab-case` | `skin-analysis-api`, `skin-analysis-web` |
| Docker volumes | `kebab-case_data` | `postgres_data`, `redis_data` |
| Env files | `.env`, `.env.prod` | per-service env files |
| Nginx configs | `nginx.{env}.conf` | `nginx.dev.conf`, `nginx.prod.conf` |

---

## 4. Tech Stack

### 4.1 Frontend Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | 14.2.18 | React SSR/SSG, App Router |
| Language | TypeScript | 5.6.3 | Type safety |
| Runtime | React | 18.3.1 | UI rendering |
| Auth | NextAuth.js | 5.0.0-beta.22 | Session management, JWT refresh |
| Styling | Tailwind CSS | 3.4.14 | Utility-first CSS |
| UI Components | shadcn/ui (Radix UI) | latest | Accessible component primitives |
| Animations | Framer Motion | 11.11.7 | Page transitions, progress UI |
| Machine Learning | TensorFlow.js | 4.21.0 | In-browser skin analysis |
| Face Detection | @tensorflow-models/face-detection | 1.0.2 | Face landmark detection |
| Camera | react-webcam | 7.2.0 | Browser camera access |
| Image Processing | sharp | 0.33.5 | Server-side image resize/EXIF strip |
| HTTP Client | axios | 1.7.7 | API calls |
| Validation | zod | 3.23.8 | Schema validation |
| Forms | react-hook-form | 7.53.2 | Form state management |
| State Management | zustand | latest | Global client state |
| Vector DB Client | @pinecone-database/pinecone | 4.0.0 | Product similarity search |
| AI SDK | @anthropic-ai/sdk | 0.32.1 | Claude API client |
| Cloud Storage | @aws-sdk/client-s3 | 3.685.0 | S3 presigned URLs |
| Analytics | posthog-js | 1.186.0 | Product analytics |
| Error Monitoring | @sentry/nextjs | 8.38.0 | Error tracking |
| Icons | lucide-react | latest | Icon library |
| Date Utils | date-fns | latest | Date formatting |
| Toasts | sonner | latest | Toast notifications |
| CSS Utilities | clsx, tailwind-merge | latest | Conditional class merging |
| Unit Tests | Vitest | latest | Component/unit testing |
| E2E Tests | Playwright | latest | Browser automation testing |

### 4.2 Backend Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Framework | FastAPI | 0.115.4 | Async REST API |
| Runtime | Python | 3.11 | Backend language |
| Server | Uvicorn (with standard extras) | 0.32.1 | ASGI server |
| Validation | Pydantic v2 | 2.9.2 | Request/response schemas |
| Settings | pydantic-settings | 2.6.1 | Env var management |
| ORM | SQLAlchemy (async) | 2.0.36 | Database access |
| DB Driver | asyncpg | 0.30.0 | PostgreSQL async driver |
| Migrations | Alembic | 1.14.0 | Schema version control |
| Vector Extension | pgvector | 0.3.5 | Embeddings in PostgreSQL |
| Auth — JWT | PyJWT | 2.9.0 | RS256/HS256 token signing |
| Auth — Password | passlib[bcrypt] | 1.7.4 | Password hashing |
| Auth — Crypto | cryptography | 43.0.3 | RSA key handling |
| Auth — OTP | pyotp | 2.9.0 | 2FA / TOTP |
| Email Validation | email-validator | 2.2.0 | Disposable email detection |
| Rate Limiting | slowapi | 0.1.9 | Per-endpoint rate limits |
| HTTP Client | httpx | 0.27.2 | Async HTTP (Claude API calls) |
| HTTP Client 2 | aiohttp | 3.11.6 | Async HTTP (other services) |
| Cloud Storage | boto3 / botocore | 1.35.66 | AWS S3 |
| Cache / Sessions | redis + hiredis | 5.2.0 / 3.0.0 | Session storage, caching |
| ML — Computer Vision | OpenCV | 4.10.0.84 | Image preprocessing |
| ML — General | scikit-learn | 1.5.2 | Feature analysis |
| ML — Deep Learning | TensorFlow CPU | 2.18.0 | Server inference |
| ML — Numerics | numpy | 1.26.4 | Array operations |
| ML — Images | Pillow | 11.0.0 | Image I/O |
| Email Sending | resend | 2.32.2 | Transactional email |
| HTML Sanitization | nh3 | 0.2.18 | Input sanitization |
| File Type Detection | python-magic-bin | 0.4.14 | MIME type validation |
| Error Monitoring | sentry-sdk[fastapi] | 2.18.0 | Error tracking |
| Security Scanner | bandit | 1.7.10 | Static security analysis (CI) |
| Malware Scanner | ClamAV (via clamav.py) | — | Uploaded file scanning |
| QR Code | qrcode | 8.0 | 2FA QR codes |
| Timezone | pytz | 2024.2 | Timezone handling |
| Slugs | python-slugify | 8.0.4 | URL-safe identifiers |
| Testing | pytest | 8.3.3 | Test runner |
| Async Testing | pytest-asyncio | 0.24.0 | Async test support |
| Coverage | pytest-cov | 6.0.0 | Test coverage (≥70%) |
| Test Fixtures | factory-boy + faker | 3.3.1 / 30.8.2 | Mock data generation |

### 4.3 Infrastructure Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Container Runtime | Docker | — | Application containerization |
| Orchestration (Dev) | Docker Compose | — | Local multi-service stack |
| Database | PostgreSQL | 15 | Primary data store |
| Cache / Pub-Sub | Redis | 7 | Sessions, rate limits, caching |
| Reverse Proxy | Nginx | 1.27 | SSL termination, routing |
| Build System | Turborepo | 2.3.1 | Monorepo parallel builds |
| Frontend Hosting | Vercel | — | Next.js deployment |
| Backend Hosting | Railway | — | FastAPI deployment |
| Database Hosting | AWS RDS | — | Managed PostgreSQL |
| Object Storage | AWS S3 | — | Temporary image storage |
| Cache Hosting | AWS ElastiCache | — | Managed Redis |
| AI Model | Claude (Anthropic) | claude-sonnet-4-6 | Skin recommendations |
| Vector Database | Pinecone | — | Product embedding search |
| Email | Resend | — | Transactional email |
| Weather API | Open-Meteo | — | Climate data (free tier) |
| Error Monitoring | Sentry | — | Both frontend + backend |
| Analytics | PostHog | — | Product analytics |
| CI/CD | GitHub Actions | — | Automated test/deploy |

---

## 5. Root Configuration

### package.json (Root)

```json
{
  "name": "skin-analysis-platform",
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.3",
  "scripts": {
    "dev":        "turbo run dev",
    "build":      "turbo run build",
    "lint":       "turbo run lint",
    "type-check": "turbo run type-check",
    "test":       "turbo run test",
    "test:e2e":   "turbo run test:e2e"
  },
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "turbo":      "^2.3.1",
    "typescript": "^5.6.3"
  }
}
```

### Root tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@skin-analysis/shared-types": ["packages/shared-types/src"]
    }
  }
}
```

---

## 6. Frontend (Next.js) Configuration

### 6.1 package.json (`@skin-analysis/web`)

**Runtime:** Node.js 20+, pnpm 9+  
**Engines:** Explicitly enforced in package.json

**Key dependencies (abbreviated):**
```
next@14.2.18                    # App Router, Server Components
react@18.3.1                    # UI framework
next-auth@5.0.0-beta.22         # Auth sessions

@tensorflow/tfjs@4.21.0         # In-browser ML
@tensorflow-models/face-detection@1.0.2

@anthropic-ai/sdk@0.32.1        # Claude AI
@pinecone-database/pinecone@4.0.0
@aws-sdk/client-s3@3.685.0

tailwindcss@3.4.14
framer-motion@11.11.7
react-hook-form@7.53.2
zod@3.23.8
axios@1.7.7
zustand@latest
sharp@0.33.5
react-webcam@7.2.0

posthog-js@1.186.0
@sentry/nextjs@8.38.0
```

### 6.2 next.config.js (137 lines)

**Content Security Policy:**
- `/scan` page: `unsafe-eval` allowed (TensorFlow.js WASM requirement)
- All other pages: strict CSP, no `unsafe-eval`
- Camera: `camera=(self)` on `/scan`; `camera=()` everywhere else

**Image Optimization Allowlist:**
- `*.amazonaws.com` (S3)
- `www.nykaa.com`, `aimg.nykimgs.com` (Nykaa)
- `cdn.minimalistindia.com` (Minimalist)
- `www.dermaco.in` (Dermaco)

**API Rewrites:**
```js
{ source: '/api/v1/:path*', destination: 'http://localhost:8000/api/v1/:path*' }
```

**Security Headers:**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000
Cross-Origin-Opener-Policy: same-origin
```

**Sentry:** Silent integration, no source maps in production.

### 6.3 tailwind.config.ts (103 lines)

**Dark Mode:** `class` strategy

**Custom Color Palette:**
```ts
colors: {
  skin: {
    50:  '#fdf8f6',   // near-white warm
    100: '#f2e8e5',
    200: '#eaddd7',
    300: '#e0cec7',
    400: '#d2bab0',
    500: '#bfa094',   // mid skin tone
    600: '#a18072',
    700: '#977669',
    800: '#65524d',
    900: '#271d1a',   // deep brown
  },
  teal: { /* medical accent */ }
}
```

**Custom Fonts:**
```ts
fontFamily: {
  sans:    ['var(--font-inter)'],
  heading: ['var(--font-poppins)'],
}
```

**Custom Animations:**
```ts
keyframes: {
  'accordion-down': { ... },
  'accordion-up':   { ... },
  'fade-in':        { ... },
  'scan-line':      { ... },  // camera scan effect
}
```

### 6.4 tsconfig.json (Frontend)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@skin-analysis/shared-types": ["../../packages/shared-types/src"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

### 6.5 .eslintrc.json (Frontend)

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

---

## 7. Backend (FastAPI) Configuration

### 7.1 app/core/config.py — Settings Class

All env vars are loaded via `pydantic-settings`. Validation runs at startup; missing required fields cause an immediate error.

```python
class Settings(BaseSettings):
    # Application
    app_name: str = "AI Skin Analysis API"
    environment: Literal["development", "staging", "production"] = "development"
    secret_key: str          # REQUIRED, min 32 chars
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]
    trusted_hosts: list[str] = ["localhost", "127.0.0.1"]

    # Database
    database_url: PostgresDsn  # postgresql+asyncpg://user:pass@host:5432/db
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_echo: bool = False      # Log SQL queries (dev only)

    # Redis
    redis_url: RedisDsn        # redis://:password@host:6379/0
    session_ttl: int = 3600    # 1 hour
    cache_ttl: int = 300       # 5 minutes

    # AWS S3
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "ap-south-1"     # Mumbai — data residency
    s3_bucket_name: str
    s3_presigned_url_expiry: int = 60  # seconds
    s3_lifecycle_expiry_days: int = 1  # auto-delete after 1 day

    # JWT
    jwt_secret_key: str          # HS256 dev fallback
    jwt_private_key: str = ""    # RS256 production (PEM)
    jwt_public_key: str = ""     # RS256 production (PEM)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Rate Limiting
    rate_limit_general: str = "100/minute"
    rate_limit_auth: str = "5/hour"
    rate_limit_login: str = "10/minute"

    # Claude AI
    anthropic_api_key: str       # sk-ant-...
    claude_model: str = "claude-sonnet-4-6"

    # Pinecone (optional — fallback to pgvector)
    pinecone_api_key: str = ""
    pinecone_index_name: str = "skin-products"

    # Email
    resend_api_key: str
    email_from: str = "noreply@yourdomain.com"
    email_from_name: str = "SkinAI"

    # Feature Flags
    enable_dermatologist_review: bool = True
    max_scans_per_user_per_day: int = 3
    clamav_enabled: bool = False   # true in production

    class Config:
        env_file = ".env"
        case_sensitive = False
```

### 7.2 app/main.py — Middleware Stack (execution order)

1. `SecurityHeadersMiddleware` — X-Frame-Options, HSTS, CSP, Permissions-Policy
2. `SlowAPIMiddleware` — rate limiting via slowapi
3. `CORSMiddleware` — CORS with allowlist origins + credentials
4. `TrustedHostMiddleware` — production only, validates Host header
5. Router mounts (9 domains, all under `/api/v1`)
6. Global exception handler → structured JSON error response

### 7.3 alembic.ini

```ini
[alembic]
script_location = alembic
file_template = %%(rev)s_%%(slug)s
sqlalchemy.url = postgresql+asyncpg://...  # overridden by env.py
```

**Migration naming:** `NNNN_description_phaseN.py` (zero-padded sequential revision).

---

## 8. Environment Variables

### 8.1 Root / FastAPI `.env` Variables

```bash
# ── Application ───────────────────────────────────────
ENVIRONMENT=development          # development | staging | production
DEBUG=true
SECRET_KEY=                      # Generate: openssl rand -hex 32
ALLOWED_ORIGINS=http://localhost:3000
TRUSTED_HOSTS=localhost,127.0.0.1

# ── JWT / Authentication ──────────────────────────────
JWT_SECRET_KEY=                  # HS256 dev fallback
JWT_PRIVATE_KEY=                 # RS256 production (PEM, \n-escaped)
JWT_PUBLIC_KEY=                  # RS256 production (PEM, \n-escaped)
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── PostgreSQL ────────────────────────────────────────
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skin_analysis
POSTGRES_USER=skin_user
POSTGRES_PASSWORD=               # REQUIRED
DATABASE_URL=postgresql+asyncpg://skin_user:password@localhost:5432/skin_analysis

# ── Redis ─────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                  # REQUIRED in production
REDIS_URL=redis://:password@localhost:6379/0
SESSION_TTL=3600
CACHE_TTL=300

# ── AWS S3 ───────────────────────────────────────────
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1            # Mumbai — India data residency
S3_BUCKET_NAME=skinanalysis-temp-images
S3_PRESIGNED_URL_EXPIRY=60       # seconds
S3_LIFECYCLE_EXPIRY_DAYS=1       # auto-delete after 1 day

# ── Anthropic / Claude ────────────────────────────────
ANTHROPIC_API_KEY=               # sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# ── Pinecone (Vector Search) ──────────────────────────
PINECONE_API_KEY=
PINECONE_INDEX_NAME=skin-products

# ── Email (Resend) ────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=SkinAI

# ── Weather ───────────────────────────────────────────
OPEN_METEO_API_URL=https://api.open-meteo.com/v1   # free, no key needed

# ── Monitoring ────────────────────────────────────────
SENTRY_DSN=

# ── Feature Flags ─────────────────────────────────────
CLAMAV_ENABLED=false             # true in production
ENABLE_DERMATOLOGIST_REVIEW=true
MAX_SCANS_PER_USER_PER_DAY=3
```

### 8.2 Frontend `.env.local` Variables

```bash
# ── NextAuth.js ───────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                  # Generate: openssl rand -base64 32

# ── FastAPI Backend ───────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# ── Monitoring ────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 9. Database Schema

### 9.1 Core Tables

#### `users`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| hashed_password | VARCHAR(255) | NOT NULL |
| full_name | VARCHAR(255) | NOT NULL |
| role | user_role enum | DEFAULT 'USER' |
| is_verified | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| last_login | TIMESTAMP | nullable |
| totp_secret | VARCHAR | nullable (2FA) |
| totp_enabled | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | auto-updated |
| deleted_at | TIMESTAMP | nullable (soft delete) |

**Enum `user_role`:** `USER`, `DERMATOLOGIST`, `ADMIN`

#### `user_profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| date_of_birth | DATE | nullable |
| gender | VARCHAR | nullable |
| city | VARCHAR | nullable (used for climate lookup) |
| state | VARCHAR | nullable |
| skin_tone_category | fitzpatrick_scale enum | nullable |
| profile_photo_url | VARCHAR | nullable |
| consent_given_at | TIMESTAMP | nullable |

**Enum `fitzpatrick_scale`:** `I`, `II`, `III`, `IV`, `V`, `VI`

#### `skin_scans`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| scan_timestamp | TIMESTAMP | DEFAULT now() |
| image_deleted_at | TIMESTAMP | always set (images never stored) |
| image_permanently_deleted | BOOLEAN | always TRUE |
| lighting_quality_score | FLOAT | 0.0–1.0 |
| skin_type | skin_type enum | nullable |
| analysis_confidence_score | FLOAT | 0.0–1.0 |
| raw_analysis_json | JSONB | full TF.js output |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Enum `skin_type`:** `oily`, `dry`, `combination`, `normal`, `sensitive`

#### `skin_conditions`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| scan_id | UUID | FK → skin_scans.id |
| condition_name | condition_name enum | |
| severity | severity enum | `mild`, `moderate`, `severe` |
| affected_zone | affected_zone enum | `forehead`, `cheeks`, `nose`, etc. |
| confidence_score | FLOAT | 0.0–1.0 |

**Enum `condition_name`:** `acne`, `dark_spots`, `pigmentation`, `wrinkles`, `dryness`, `oiliness`, `uneven_tone`, `dark_circles`

#### `questionnaire_responses`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| scan_id | UUID | FK → skin_scans.id |
| sleep_quality | INT | 1–5 |
| diet_score | INT | 1–5 |
| stress_level | INT | 1–5 |
| water_intake | FLOAT | liters/day |
| uv_exposure_hours | FLOAT | hours/day |
| pollution_city | VARCHAR | city name |
| exercise_days | INT | days/week |
| current_products | JSONB | array of product names |
| allergies | TEXT[] | |
| submitted_at | TIMESTAMP | |

#### `recommendations`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| scan_id | UUID | FK → skin_scans.id |
| questionnaire_id | UUID | FK → questionnaire_responses.id |
| generated_at | TIMESTAMP | |
| ai_reasoning | TEXT | Claude's explanation |
| skin_score | FLOAT | 0.0–100.0 |
| confidence_score | FLOAT | 0.0–1.0 |
| estimated_monthly_cost_inr | INT | |
| roadmap_json | JSONB | 8-week week-by-week plan |
| allergen_flags | TEXT[] | |
| requires_derm_review | BOOLEAN | |
| is_dermatologist_reviewed | BOOLEAN | DEFAULT false |
| reviewer_id | UUID | FK → users.id (derm) |
| reviewed_at | TIMESTAMP | |
| feedback_rating | INT | 1–5 |
| feedback_text | TEXT | |
| metadata_json | JSONB | lifestyle_tips, ingredients_to_use/avoid, morning_routine, night_routine |

#### `products`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| brand | product_brand enum | `nykaa`, `minimalist`, `dermaco` |
| product_name | VARCHAR | |
| product_url | VARCHAR | |
| price_inr | INT | |
| category | product_category enum | cleanser/toner/serum/moisturiser/sunscreen/treatment/mask |
| key_ingredients | TEXT[] | |
| targets_conditions | TEXT[] | |
| skin_types_suitable | TEXT[] | |
| fitzpatrick_suitable | TEXT[] | |
| is_dermatologist_approved | BOOLEAN | DEFAULT false |
| rating_avg | FLOAT | |
| review_count | INT | |
| is_active | BOOLEAN | DEFAULT true |

#### `progress_scans`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| week_number | INT | 1–8 |
| self_rating | INT | 1–5 |
| notes | TEXT | nullable |
| progress_photo_url | VARCHAR | nullable |
| created_at | TIMESTAMP | |

#### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| token_hash | VARCHAR | SHA-256 hash of opaque token |
| expires_at | TIMESTAMP | |
| revoked | BOOLEAN | DEFAULT false |
| ip_address | INET | |
| user_agent | VARCHAR | |

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| action | VARCHAR | e.g. `LOGIN`, `SCAN_SUBMITTED` |
| entity_type | VARCHAR | `user`, `scan`, `recommendation` |
| entity_id | UUID | |
| ip_address | INET | |
| timestamp | TIMESTAMP | DEFAULT now() |
| metadata | JSONB | extra context |

### 9.2 Base Mixins

All SQLAlchemy models inherit from:

```python
class UUIDMixin:
    id: UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

class TimestampMixin:
    created_at: datetime = Column(DateTime, default=func.now())
    updated_at: datetime = Column(DateTime, onupdate=func.now())

class SoftDeleteMixin:
    is_active: bool = Column(Boolean, default=True)
    deleted_at: Optional[datetime] = Column(DateTime, nullable=True)
```

---

## 10. API Architecture

### 10.1 Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:8000/api/v1` |
| Production | `https://api.yourdomain.com/api/v1` |
| Via Next.js proxy | `/api/v1/*` (rewrites to FastAPI) |

### 10.2 Router Domains

| Prefix | File | Endpoints |
|---|---|---|
| `/auth` | routers/auth.py | register/user, register/dermatologist, login, refresh, logout, forgot-password, reset-password, verify-email |
| `/users` | routers/users.py | GET/PATCH /me, DELETE /me |
| `/scan` | routers/scan.py | POST /submit, GET /history, GET /{id} |
| `/questionnaire` | routers/questionnaire.py | POST /, GET /latest |
| `/recommendations` | routers/recommendations.py | POST /generate, GET /latest, GET /{id}, GET /{id}/roadmap, GET /{id}/products, POST /{id}/feedback |
| `/products` | routers/products.py | GET /, GET /{id}, GET /search |
| `/progress` | routers/progress.py | POST /, GET /, GET /week/{week_number} |
| `/dermatologist` | routers/dermatologist.py | GET /queue, PATCH /case/{id}/approve, PATCH /case/{id}/modify, PATCH /case/{id}/reject |
| `/privacy` | routers/privacy.py | POST /export, DELETE /delete |

### 10.3 Authentication Flow

```
Client                NextAuth             FastAPI
  │                      │                    │
  ├─POST /auth/login─────►                    │
  │                      ├─POST /api/v1/auth/login─►
  │                      │                    │ JWT (15min) + refresh_token
  │◄─access_token (cookie)─────────────────────┤
  │◄─refresh_token (httpOnly cookie)────────────┤
  │                      │                    │
  ├─(API request)────────►                    │
  │  Authorization: Bearer {access_token}     │
  │                      ├─proxy──────────────►
  │                      │                    │ validate JWT
  │◄─────────────────────────────────────────►│
  │                      │                    │
  │ (access_token within 60s of expiry)        │
  ├─(silent refresh)─────►                    │
  │                      ├─POST /auth/refresh─►
  │                      │  {refresh_token}   │ rotate token
  │◄─new access_token (cookie)─────────────────┤
```

### 10.4 Rate Limits

| Endpoint Group | Limit |
|---|---|
| General API | 100 requests / minute |
| Auth (register, forgot-password) | 5 requests / hour |
| Login | 10 requests / minute |
| Scan submission | 3 scans / user / day (app-level) |

### 10.5 Error Response Format

```json
{
  "detail": "Human-readable error message",
  "code": "ERROR_CODE",
  "field": "email"
}
```

HTTP status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 422 (unprocessable entity), 429 (rate limited), 500 (server error).

---

## 11. Shared Types (TypeScript)

**Package:** `@skin-analysis/shared-types`  
**Location:** `packages/shared-types/src/index.ts`

```typescript
// ── User & Auth ──────────────────────────────────────
type UserRole = "USER" | "DERMATOLOGIST"

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  age?: number
  gender?: string
  skinTone?: string
  city?: string
  createdAt: string
}

interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: "bearer"
  user: User
}

// ── Skin Analysis ────────────────────────────────────
type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive"

type SkinCondition =
  | "acne"
  | "pigmentation"
  | "dark_circles"
  | "uneven_tone"
  | "wrinkles"
  | "dryness"
  | "oiliness"
  | "dark_spots"

type ScanStatus = "uploading" | "analyzing" | "complete" | "failed"

interface TFJSResult {
  skinType: SkinType
  conditions: SkinCondition[]
  confidenceScores: Record<SkinType, number>
}

// ── Questionnaire ────────────────────────────────────
interface QuestionnaireAnswers {
  scanId: string
  sleepQuality: number          // 1–5
  dietScore: number             // 1–5
  stressLevel: number           // 1–5
  waterIntakeLiters: number
  uvExposureHours: number
  exerciseDaysPerWeek: number
  currentProducts: string[]
  allergies: string[]
  skinConcerns: string[]
}

// ── Recommendations ──────────────────────────────────
type ProductBrand = "Nykaa" | "Minimalist" | "Dermaco"

interface ProductRecommendation {
  name: string
  brand: ProductBrand
  category: string
  reason: string
  usage: string
  priceInr?: number
  imageUrl?: string
  affiliateUrl?: string
}

interface Recommendation {
  id: string
  scanId: string
  products: ProductRecommendation[]
  morningRoutine: string[]
  nightRoutine: string[]
  ingredientsToUse: string[]
  ingredientsToAvoid: string[]
  lifestyleTips: string[]
  dermatologistApproved: boolean
  dermNotes?: string
  createdAt: string
}

// ── Progress ─────────────────────────────────────────
interface ProgressEntry {
  id: string
  userId: string
  weekNumber: number            // 1–8
  selfRating: number            // 1–5
  notes?: string
  createdAt: string
}

// ── API Responses ─────────────────────────────────────
interface ApiError {
  detail: string
  code?: string
  field?: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
```

---

## 12. Key Features & Workflows

### 12.1 User Registration & Authentication

```
1. POST /auth/register/user
   → Validate: no disposable email, password not in blocklist
   → Hash password (bcrypt, cost 12)
   → Send OTP via Resend email

2. POST /auth/verify-email  { otp }
   → Mark is_verified = true
   → AuditLog: EMAIL_VERIFIED

3. POST /auth/login  { email, password }
   → Verify password (bcrypt)
   → Issue access_token (JWT, 15min) + refresh_token (opaque, 7d)
   → Store refresh_token_hash in DB
   → Set httpOnly cookies via NextAuth

4. Silent token refresh (NextAuth JWT callback)
   → Triggers when token within 60s of expiry
   → POST /auth/refresh  { refresh_token }
   → Server: revoke old token, issue new pair (rotation)
```

### 12.2 Skin Scan Pipeline

```
1. User opens /scan page
   → TensorFlow.js loads model from /public/models/
   → react-webcam streams camera feed

2. In-browser analysis (TF.js — no data leaves device)
   → Face detection → landmark extraction
   → Classify: skin_type, conditions[], confidence_scores
   → Extract: 512-dimensional feature vector

3. POST /api/v1/scan/submit
   {
     feature_vector: float[512],
     skin_type: "oily",
     conditions: ["acne", "pigmentation"],
     confidence_score: 0.87,
     lighting_quality: 0.92
   }
   → Validate vector dimension (must be 512)
   → Validate confidence thresholds
   → Flag Fitzpatrick IV-VI with confidence < 0.70 (bias warning)
   → Store SkinScan (image_permanently_deleted = TRUE)
   → Return scan_id

4. Privacy guarantee:
   → Raw face image NEVER leaves the browser
   → Only feature vector + labels sent to server
```

### 12.3 Questionnaire & Climate Context

```
1. POST /api/v1/questionnaire
   → 12 lifestyle questions (sleep, diet, stress, water, UV, etc.)
   → Linked to scan_id
   → Store QuestionnaireResponse

2. Climate enrichment (services/climate_service.py)
   → Call Open-Meteo API with user.city
   → Returns: humidity, UV index, AQI, temperature
   → Redis cache: TTL 3600s (per city)
   → Appended to recommendation context
```

### 12.4 AI Recommendation Engine

```
1. POST /api/v1/recommendations/generate
   → Collects from DB:
     - SkinScan (conditions, skin_type, confidence)
     - QuestionnaireResponse (all 12 fields)
     - UserProfile (Fitzpatrick scale, city)
     - Climate data (from Redis / Open-Meteo)

2. Build structured prompt → POST to Claude API
   (claude-sonnet-4-6 via httpx REST)

3. Claude response includes:
   - 3 products per category (from Nykaa/Minimalist/Dermaco)
   - Morning & night routine steps
   - Ingredients to use / avoid
   - Lifestyle change recommendations
   - 8-week roadmap (week-by-week targets)

4. Product embedding refinement (optional)
   → pgvector (local) or Pinecone (cloud)
   → Rank products by embedding similarity to conditions

5. Store Recommendation in DB
   → metadata_json: routines, tips, ingredient lists
   → roadmap_json: 8-week structured plan
   → Estimate monthly cost in INR

6. If Fitzpatrick IV-VI or confidence < threshold:
   → Set requires_derm_review = true
   → Add to dermatologist review queue
```

### 12.5 Dermatologist Review (Phase 8)

```
1. Recommendation flagged → added to review_queue

2. Dermatologist logs in → GET /dermatologist/queue
   → Lists pending cases with full scan + recommendation data

3. Dermatologist actions:
   → PATCH /case/{id}/approve     → set is_dermatologist_reviewed = true
   → PATCH /case/{id}/modify  { changes }  → update products/routine + approve
   → PATCH /case/{id}/reject  { notes }    → user notified to rescan

4. User notified via Resend email when review complete
```

### 12.6 8-Week Progress Tracking

```
1. POST /api/v1/progress  { week_number, self_rating, notes }
   → Linked to user_id
   → Optional: progress_photo_url (processed with EXIF strip)

2. GET /api/v1/progress
   → Returns all 8 entries (padded with nulls for incomplete weeks)

3. Frontend: Framer Motion timeline + improvement charts
4. Week 8: Summary comparison, product refresh recommendations
```

---

## 13. Security Architecture

### 13.1 Authentication & Sessions

| Mechanism | Implementation |
|---|---|
| Access Token | JWT, RS256 (prod) / HS256 (dev), 15-min expiry |
| Refresh Token | Opaque 48-byte URL-safe token, SHA-256 hashed in DB |
| Token Rotation | Single-use refresh tokens; revoked on each refresh |
| Session Storage | Redis-backed, 3600s TTL |
| Cookie Config | httpOnly, Secure (prod), SameSite=Lax |
| 2FA | TOTP via pyotp, QR code via qrcode |

### 13.2 Password Security

- bcrypt, cost factor **12**
- Common password blocklist (40+ weak passwords + India-specific variants)
- Disposable email detection (60+ blocked domains)
- Minimum length enforced at schema validation (Pydantic)

### 13.3 API Protection

| Layer | Mechanism |
|---|---|
| CORS | Origin whitelist, credentials=true |
| CSRF | Custom token endpoint `/api/csrf`, double-submit pattern |
| Rate Limiting | slowapi (per-endpoint limits, Redis-backed) |
| Host Validation | TrustedHostMiddleware (production only) |
| Input Sanitization | nh3 (HTML), pydantic (types/lengths), file MIME checks |
| File Security | ClamAV malware scan (production), MIME type validation |

### 13.4 Data Privacy

| Concern | Implementation |
|---|---|
| Face images | Never stored — only 512-dim feature vectors |
| S3 URLs | Presigned, 60-second expiry |
| S3 Lifecycle | Auto-delete after 1 day |
| EXIF data | Stripped server-side via Sharp/Pillow |
| Soft deletes | `is_active = false`, `deleted_at = now()` |
| GDPR export | `/privacy/export` endpoint |
| Data deletion | `/privacy/delete` endpoint (full cascade) |
| Face blurring | Applied after analysis (progress photos) |
| Consent | `consent_given_at` timestamp in user_profiles |

### 13.5 Security Headers (every response)

```
X-Frame-Options:           DENY
X-Content-Type-Options:    nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy:        camera=() [except /scan: camera=(self)]
Content-Security-Policy:   [strict; unsafe-eval only on /scan for TF.js]
```

### 13.6 Audit & Monitoring

- PostgreSQL triggers: auto-log changes to users, scans, recommendations
- `AuditLog` model: explicit application-level logging
- Sentry: error tracking (both FastAPI and Next.js)
- PostHog: product analytics (anonymized)
- Bandit: static security analysis (CI, fail on HIGH)
- gitleaks: secret leak detection (CI)

### 13.7 Row-Level Security (Phase 10)

- PostgreSQL RLS policies (migration `0005_rls_phase10.py`)
- Users can only SELECT/UPDATE their own rows
- Dermatologists can SELECT assigned cases
- Enforced at the database level, independent of application code

---

## 14. Testing Strategy

### 14.1 Backend (Pytest)

| Aspect | Configuration |
|---|---|
| Test runner | pytest 8.3.3 |
| Async support | pytest-asyncio 0.24.0 |
| Coverage | pytest-cov, minimum **70%** (CI-enforced) |
| Fixtures | factory-boy + faker |
| Location | `apps/api/tests/` |
| Config | `apps/api/pytest.ini` |
| CI command | `pytest tests/ --cov=app --cov-fail-under=70` |
| Database | Full integration (real PostgreSQL, no mocks) |

### 14.2 Frontend (Vitest + Playwright)

| Aspect | Configuration |
|---|---|
| Unit test runner | Vitest |
| Component testing | React Testing Library |
| Unit test location | `apps/web/__tests__/` |
| E2E runner | Playwright |
| E2E browser | Chromium (headless) |
| E2E location | `apps/web/tests/` |
| E2E config | `apps/web/playwright.config.ts` |

### 14.3 Security Testing (CI)

| Tool | Scope | Failure Condition |
|---|---|---|
| Bandit | Python source (`apps/api/`) | HIGH severity finding |
| npm audit | Node dependencies (`apps/web/`) | Critical vulnerability |
| gitleaks | Entire repository | Any detected secret |

---

## 15. Deployment & Infrastructure

### 15.1 Local Development

```bash
# 1. Clone & install
git clone <repo>
cd skin-analysis-platform
pnpm install

# 2. Python backend
cd apps/api
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cd ../..

# 3. Configure environment
cp .env.example .env
cp .env.local.example apps/web/.env.local
# Edit both files with your credentials

# 4. Start infrastructure
cd infrastructure
docker compose up postgres redis -d
cd ..

# 5. Run DB migrations
cd apps/api
alembic upgrade head
cd ../..

# 6. Start all apps (Turborepo)
pnpm dev
# OR individually:
# pnpm --filter @skin-analysis/web dev
# uvicorn app.main:app --reload (in apps/api/)
```

**Dev ports:**
- Next.js frontend: `http://localhost:3000`
- FastAPI backend: `http://localhost:8000`
- FastAPI docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 15.2 Docker Compose (Full Stack)

```bash
cd infrastructure
docker compose up --build
# Nginx on :80, Next.js on :3000, FastAPI on :8000
```

**Services:**
| Service | Image | Port | Purpose |
|---|---|---|---|
| postgres | postgres:15-alpine | 5432 | Primary DB |
| redis | redis:7-alpine | 6379 | Cache + sessions |
| fastapi | ./apps/api/Dockerfile | 8000 | Backend API |
| nextjs | ./apps/web/Dockerfile | 3000 | Frontend |
| nginx | nginx:1.27-alpine | 80/443 | Reverse proxy, SSL |

### 15.3 Dockerfiles

**apps/api/Dockerfile** (multi-stage)
```dockerfile
FROM python:3.11-slim

# System deps: OpenCV (libgl1-mesa-glx), PostgreSQL (libpq-dev), GCC
RUN apt-get install -y libgl1-mesa-glx libpq-dev gcc

# Non-root user
RUN useradd -u 1001 appuser
USER appuser

COPY requirements.txt .
RUN pip install -r requirements.txt

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**apps/web/Dockerfile** (4-stage)
```dockerfile
# Stage 1: base (node:20-alpine, corepack pnpm)
# Stage 2: deps (pnpm install)
# Stage 3: builder (pnpm build, standalone output)
# Stage 4: runner (node:20-alpine, non-root nextjs:1001)
CMD ["node", "server.js"]    # Next.js standalone
```

### 15.4 Production Targets

| Component | Platform | Command |
|---|---|---|
| Frontend | Vercel | Auto-deploy on push to `main` |
| Backend | Railway | `railway up` |
| Database | AWS RDS (PostgreSQL 15) | Alembic migrations in CI |
| Storage | AWS S3 (ap-south-1) | Via boto3 |
| Cache | AWS ElastiCache (Redis) | Via redis-py |

---

## 16. Dependencies Summary

### 16.1 Frontend (Top Packages)

| Category | Package | Version |
|---|---|---|
| Framework | next | 14.2.18 |
| Framework | react, react-dom | 18.3.1 |
| Auth | next-auth | 5.0.0-beta.22 |
| ML | @tensorflow/tfjs | 4.21.0 |
| ML | @tensorflow-models/face-detection | 1.0.2 |
| AI | @anthropic-ai/sdk | 0.32.1 |
| Vector DB | @pinecone-database/pinecone | 4.0.0 |
| Cloud | @aws-sdk/client-s3 | 3.685.0 |
| UI | tailwindcss | 3.4.14 |
| UI | framer-motion | 11.11.7 |
| Forms | react-hook-form | 7.53.2 |
| Validation | zod | 3.23.8 |
| HTTP | axios | 1.7.7 |
| State | zustand | latest |
| Camera | react-webcam | 7.2.0 |
| Image | sharp | 0.33.5 |
| Analytics | posthog-js | 1.186.0 |
| Monitoring | @sentry/nextjs | 8.38.0 |
| Icons | lucide-react | latest |
| Dates | date-fns | latest |
| Toasts | sonner | latest |

### 16.2 Backend (46 Packages)

| Category | Package | Version |
|---|---|---|
| Framework | fastapi | 0.115.4 |
| Server | uvicorn[standard] | 0.32.1 |
| Validation | pydantic | 2.9.2 |
| Config | pydantic-settings | 2.6.1 |
| ORM | sqlalchemy | 2.0.36 |
| DB Driver | asyncpg | 0.30.0 |
| Migrations | alembic | 1.14.0 |
| Vector | pgvector | 0.3.5 |
| JWT | PyJWT | 2.9.0 |
| Passwords | passlib[bcrypt], bcrypt | 1.7.4 / 4.0.1 |
| Crypto | cryptography | 43.0.3 |
| OTP | pyotp | 2.9.0 |
| Email Val | email-validator | 2.2.0 |
| Rate Limit | slowapi | 0.1.9 |
| HTTP | httpx | 0.27.2 |
| HTTP | aiohttp | 3.11.6 |
| Cloud | boto3, botocore | 1.35.66 |
| Cache | redis, hiredis | 5.2.0 / 3.0.0 |
| CV | opencv-python-headless | 4.10.0.84 |
| ML | scikit-learn | 1.5.2 |
| DL | tensorflow-cpu | 2.18.0 |
| Numerics | numpy | 1.26.4 |
| Images | Pillow | 11.0.0 |
| Email | resend | 2.32.2 |
| Sanitize | nh3 | 0.2.18 |
| File Type | python-magic-bin | 0.4.14 |
| Monitoring | sentry-sdk[fastapi] | 2.18.0 |
| Security | bandit | 1.7.10 |
| QR | qrcode | 8.0 |
| TZ | pytz | 2024.2 |
| Slugs | python-slugify | 8.0.4 |
| Testing | pytest | 8.3.3 |
| Testing | pytest-asyncio | 0.24.0 |
| Testing | pytest-cov | 6.0.0 |
| Fixtures | factory-boy, faker | 3.3.1 / 30.8.2 |

---

## 17. CI/CD Pipelines

### 17.1 `.github/workflows/ci.yml`

Triggered on: push to `main`/`develop`, pull requests.

| Job | Steps | Failure Condition |
|---|---|---|
| `test-backend` | Start PostgreSQL, run Alembic migrations, `pytest --cov-fail-under=70` | Coverage < 70% or test failure |
| `security-scan-backend` | Bandit static analysis on `apps/api/` | HIGH severity finding |
| `test-frontend` | `vitest run` | Any test failure |
| `security-scan-frontend` | `npm audit --audit-level=critical` | Critical vulnerability |
| `secret-scan` | gitleaks on full repo | Any leaked secret detected |
| `test-e2e` | Playwright against preview deployment | Any E2E failure |

### 17.2 `.github/workflows/deploy.yml`

Triggered on: push to `main` (after CI passes).

```
1. Build Docker images
   → docker build apps/api/ → push to AWS ECR
   → docker build apps/web/ → push to AWS ECR
   → Tag: :latest + :sha-{short}

2. Run DB migrations
   → alembic upgrade head (against production RDS)

3. Deploy FastAPI
   → railway up (Railway platform)

4. Deploy Next.js
   → vercel --prod (Vercel platform)

5. Notify
   → Slack webhook: success or failure
```

---

## 18. Secrets Rotation Schedule

| Secret | Variable | Rotation | How to Rotate |
|---|---|---|---|
| JWT Private Key | `JWT_PRIVATE_KEY` | Every 90 days | Generate new RSA pair: `openssl genrsa -out private.pem 4096` |
| NextAuth Secret | `NEXTAUTH_SECRET` | Every 90 days | `openssl rand -base64 32` |
| App Secret Key | `SECRET_KEY` | Every 90 days | `openssl rand -hex 32` |
| Claude API Key | `ANTHROPIC_API_KEY` | Every 90 days | console.anthropic.com → API Keys |
| Pinecone API Key | `PINECONE_API_KEY` | Every 90 days | app.pinecone.io → API Keys |
| AWS Access Key | `AWS_ACCESS_KEY_ID` | Every 90 days | AWS IAM → Security Credentials → Rotate |
| Resend API Key | `RESEND_API_KEY` | Every 90 days | resend.com → API Keys |
| PostgreSQL Password | `POSTGRES_PASSWORD` | Every 90 days | AWS RDS → Modify instance |
| Redis Password | `REDIS_PASSWORD` | Every 90 days | AWS ElastiCache / Docker secret |

---

## 19. Quick Reference: Key Paths

| Purpose | Path |
|---|---|
| **Frontend entry** | [apps/web/app/layout.tsx](apps/web/app/layout.tsx) |
| **Backend entry** | [apps/api/app/main.py](apps/api/app/main.py) |
| **NextAuth config** | [apps/web/lib/auth.ts](apps/web/lib/auth.ts) |
| **Route middleware** | [apps/web/middleware.ts](apps/web/middleware.ts) |
| **Next.js config** | [apps/web/next.config.js](apps/web/next.config.js) |
| **Tailwind config** | [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts) |
| **FastAPI settings** | [apps/api/app/core/config.py](apps/api/app/core/config.py) |
| **FastAPI security** | [apps/api/app/core/security.py](apps/api/app/core/security.py) |
| **DB models** | [apps/api/app/models/](apps/api/app/models/) |
| **API schemas** | [apps/api/app/schemas/](apps/api/app/schemas/) |
| **API routers** | [apps/api/app/routers/](apps/api/app/routers/) |
| **Business logic** | [apps/api/app/services/](apps/api/app/services/) |
| **React components** | [apps/web/components/](apps/web/components/) |
| **Shared TS types** | [packages/shared-types/src/index.ts](packages/shared-types/src/index.ts) |
| **DB migrations** | [apps/api/alembic/versions/](apps/api/alembic/versions/) |
| **Docker Compose** | [infrastructure/docker-compose.yml](infrastructure/docker-compose.yml) |
| **CI pipeline** | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| **CD pipeline** | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| **Env template** | [.env.example](.env.example) |
| **Frontend env** | [.env.local.example](.env.local.example) |
| **Architecture docs** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **API docs** | [docs/API.md](docs/API.md) |
| **Privacy docs** | [docs/DATA_PRIVACY.md](docs/DATA_PRIVACY.md) |

---

*Generated: 2026-06-25 | Project Phase: 10 — Security Hardening & Production Deployment*
