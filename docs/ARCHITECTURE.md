# System Architecture & Data Flow

## Overview

The platform is a **monorepo** containing a Next.js 14 frontend and a FastAPI backend, connected via REST. AI inference runs at two layers: **in-browser** (TensorFlow.js for instant feedback) and **server-side** (scikit-learn + OpenCV for validated results, Claude API for recommendations).

---

## High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │  Camera API  │──▶│  TF.js Skin      │──▶│  React UI      │  │
│  │  (WebRTC)    │   │  Classifier      │   │  (Next.js 14)  │  │
│  └──────────────┘   └──────────────────┘   └───────┬────────┘  │
│                                                     │           │
└─────────────────────────────────────────────────────┼───────────┘
                                                      │ HTTPS
                          ┌───────────────────────────▼───────────┐
                          │            NGINX (Reverse Proxy)       │
                          └──────────┬──────────────────┬──────────┘
                                     │                  │
                    ┌────────────────▼──┐    ┌──────────▼──────────┐
                    │  Next.js Server   │    │    FastAPI (Python)  │
                    │  - NextAuth.js    │    │    - /api/v1/*       │
                    │  - API Proxy      │    │    - Pydantic v2     │
                    │  - SSR/RSC        │    │    - SQLAlchemy 2.0  │
                    └────────────────┬──┘    └──────────┬──────────┘
                                     │                  │
                          ┌──────────┘                  │
                          │          ┌──────────────────┼─────────────────┐
                          │          │                  │                 │
                    ┌─────▼──┐  ┌────▼────┐  ┌─────────▼────┐  ┌────────▼──────┐
                    │  JWT   │  │PostgreSQL│  │    Redis 7   │  │   Pinecone    │
                    │Session │  │    15    │  │  (sessions + │  │ (product vec- │
                    │(Redis) │  │(primary) │  │   cache)     │  │  tor store)   │
                    └────────┘  └─────────┘  └──────────────┘  └───────────────┘
                                                                        │
                                                              ┌─────────▼──────────┐
                                                              │   Claude API        │
                                                              │ (Anthropic SDK)     │
                                                              │ Recommendation Eng. │
                                                              └─────────────────────┘
```

---

## Request Data Flow — Full Scan Cycle

```
1. USER OPENS CAMERA (browser)
   └─▶ WebRTC MediaStream captured via react-webcam
   └─▶ TF.js loads skin model from /public/models/ (cached after first load)

2. FRAME CAPTURE & IN-BROWSER ANALYSIS
   └─▶ TF.js classifies: skin type (dry/oily/combination/normal/sensitive)
   └─▶ Detected conditions: acne, pigmentation, dark circles, uneven tone
   └─▶ Confidence scores returned instantly (< 200ms)

3. IMAGE UPLOAD (privacy-first pipeline)
   └─▶ Image → Sharp (server-side): EXIF stripped, resized to 512×512
   └─▶ POST /api/v1/scan/upload → FastAPI
   └─▶ FastAPI generates S3 presigned PUT URL (60s expiry)
   └─▶ Client uploads directly to S3 (skips FastAPI for bandwidth)
   └─▶ S3 key stored in DB with scan record

4. SERVER-SIDE VALIDATION
   └─▶ FastAPI downloads image from S3 via presigned GET URL
   └─▶ OpenCV preprocessing (lighting normalization, face crop)
   └─▶ scikit-learn model validates TF.js result
   └─▶ Analysis result written to PostgreSQL (scan table)
   └─▶ S3 deletion scheduled (60s TTL lifecycle policy)

5. QUESTIONNAIRE
   └─▶ User answers 12 questions: sleep quality, diet, stress, water intake,
       UV exposure, pollution level, exercise, current products
   └─▶ POST /api/v1/questionnaire → stored in PostgreSQL
   └─▶ Climate data fetched from OpenWeatherMap by user's city (cached Redis)

6. RECOMMENDATION ENGINE (Claude API)
   └─▶ FastAPI builds structured prompt:
       - Skin analysis results
       - Questionnaire answers
       - Climate/AQI data
       - User profile (age, gender, skin tone)
   └─▶ Claude API (claude-sonnet-4-6) returns:
       - 3 product recommendations per category
       - Ingredients to use / avoid
       - Morning & night skincare routine
       - Lifestyle changes
   └─▶ Product embedding similarity search in Pinecone
       refines to available Nykaa/Minimalist/Dermaco SKUs
   └─▶ Recommendations stored in PostgreSQL

7. DERMATOLOGIST REVIEW (async)
   └─▶ Case added to review queue in PostgreSQL
   └─▶ Dermatologist dashboard polls queue
   └─▶ Approve / modify / reject recommendation
   └─▶ User notified via email

8. RESULTS DELIVERED
   └─▶ Frontend polls GET /api/v1/results/{scan_id}
   └─▶ Framer Motion animated results page
   └─▶ Product cards with Nykaa/Minimalist/Dermaco deep links
   └─▶ 8-week skincare roadmap generated
```

---

## Database Schema (Logical)

```
users
  id, email, password_hash, role, name, age, gender, skin_tone,
  city, created_at, last_login

scans
  id, user_id, skin_type, conditions[], confidence_scores{},
  tfjs_result{}, server_result{}, s3_key (deleted after 60s),
  status, created_at

questionnaire_responses
  id, user_id, scan_id, sleep_quality, diet_score, stress_level,
  water_intake_liters, uv_exposure_hours, pollution_city, exercise_days,
  current_products[], submitted_at

recommendations
  id, scan_id, user_id, claude_response{}, products[], routine{},
  lifestyle_changes[], dermatologist_approved, approved_by, created_at

products
  id, brand (nykaa|minimalist|dermaco), name, slug, category,
  ingredients[], price_inr, image_url, affiliate_url, embedding_id,
  active

progress_logs
  id, user_id, week_number, photo_s3_key, self_rating, notes, created_at

dermatologist_reviews
  id, scan_id, dermatologist_id, status, notes, modified_recommendations{},
  reviewed_at
```

---

## Authentication Flow

```
Login ──▶ POST /api/auth (NextAuth)
          └─▶ Credentials verified against PostgreSQL
          └─▶ JWT access token (15 min) + refresh token (7 days)
          └─▶ Refresh token stored in Redis (revocable)
          └─▶ HttpOnly cookie set

Protected route ──▶ middleware.ts checks session
                    └─▶ Role extracted from JWT
                    └─▶ Route matrix enforced (USER / DERM / ADMIN)
```

---

## AI Model Architecture

### In-Browser (TF.js)
- **Model**: MobileNetV2 fine-tuned on skin dataset
- **Input**: 224×224 RGB face crop
- **Output**: 5-class skin type + 8 condition probabilities
- **Latency**: < 200ms on mobile (WebGL backend)
- **Files**: `/public/models/skin_model/model.json` + shards

### Server-Side Validation (scikit-learn)
- **Features**: Color histogram, texture (LBP), HOG descriptors from OpenCV
- **Model**: Gradient Boosting Classifier
- **Purpose**: Cross-validate TF.js result; catch adversarial/poor lighting inputs

### Recommendation Engine (Claude API)
- **Model**: claude-sonnet-4-6
- **Prompt strategy**: Structured JSON context + chain-of-thought reasoning
- **Output schema**: Validated with Pydantic before storage
- **Fallback**: Pre-computed rule-based recommendations if Claude is unavailable

---

## Deployment Topology

```
Production:

  Vercel (Next.js)  ◄──HTTPS──►  Railway/Render (FastAPI)
         │                                │
         │                         ┌──────┴──────┐
         │                         │  Neon/RDS   │  PostgreSQL
         │                         │  Upstash    │  Redis
         │                         │  Pinecone   │  Vectors
         │                         │  AWS S3     │  Images (ephemeral)
         │                         └─────────────┘
         │
   Sentry + PostHog (observability)
```

---

## Security Measures

| Layer | Control |
|-------|---------|
| Auth | JWT HS256, refresh token rotation, HttpOnly cookies |
| Transport | TLS 1.3 (HTTPS everywhere) |
| Images | EXIF stripped, S3 presigned URLs (60s), auto-deleted |
| API | Rate limiting (Redis sliding window), input validation (Pydantic) |
| Database | Parameterized queries (SQLAlchemy ORM), no raw SQL |
| Secrets | Environment variables only — never in code |
| CORS | Allowlist via `ALLOWED_ORIGINS` env var |
