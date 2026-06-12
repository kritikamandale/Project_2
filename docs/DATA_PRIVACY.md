# Data Privacy & Compliance

## Principles

This platform is designed with **privacy-by-default** for Indian users. Face images are treated as biometric data under India's **Digital Personal Data Protection (DPDP) Act 2023** and aligned with **GDPR** Article 9 (special category data) for global readiness.

---

## Image Data — Lifecycle

```
Capture ──▶ EXIF Strip ──▶ S3 Upload (60s presign) ──▶ Analysis ──▶ DELETE
   0s           0s             < 5s                   < 30s        ≤ 60s
```

1. **No raw image stored on our servers.** The client uploads directly to S3 via a presigned PUT URL.
2. **EXIF metadata removed** server-side using Sharp before any image leaves the client context.
3. **Presigned S3 URL expires in 60 seconds.** The URL is single-use and time-bound.
4. **S3 Lifecycle Policy** deletes objects after 1 day as a hard backstop.
5. **Face blur applied** after analysis completion before any human review.
6. **Dermatologist reviewers see only blurred images** — they review text analysis results, not raw photos.

---

## Personal Data Collected

| Data | Purpose | Retention | Deletable |
|------|---------|-----------|-----------|
| Email + password hash | Authentication | Until account deleted | Yes |
| Name, age, gender, city | Personalised recommendations | Until account deleted | Yes |
| Skin analysis results | Historical trend tracking | 2 years | Yes |
| Questionnaire answers | Recommendation context | 2 years | Yes |
| Progress photos | Optional self-tracking | Until user deletes | Yes |
| Session tokens | Auth security | 7 days (Redis TTL) | Yes |

---

## User Rights (DPDP Act 2023 + GDPR)

| Right | Implementation |
|-------|---------------|
| **Access** | `GET /users/me` returns all stored personal data |
| **Correction** | `PATCH /users/me` updates any profile field |
| **Erasure** | `DELETE /users/me` permanently deletes account + cascade-deletes all data |
| **Portability** | `GET /users/me/export` returns full data as JSON |
| **Withdraw consent** | Toggle in Profile settings disables analytics tracking |

---

## Security Controls

| Control | Implementation |
|---------|---------------|
| Data in transit | TLS 1.3 (HTTPS enforced) |
| Data at rest | PostgreSQL encrypted volumes (AWS RDS encryption or Docker secrets) |
| S3 encryption | SSE-S3 (AES-256) on all objects |
| Password storage | bcrypt (cost factor 12) via passlib |
| JWT secrets | HS256, rotated on compromise, stored in environment only |
| Rate limiting | Redis sliding window — 100 req/min per user, 10 scan uploads/day |
| SQL injection | SQLAlchemy ORM parameterized queries only |
| XSS | React escapes by default; CSP headers via Next.js config |
| CORS | Strict allowlist via `ALLOWED_ORIGINS` env var |

---

## Consent & Transparency

- Explicit **informed consent** is collected before camera activation.
- Users are shown a **privacy notice** explaining exactly what data is captured and when images are deleted.
- No image is uploaded without an explicit "Analyze my skin" button press.
- Analytics (PostHog) respects the user's `Do Not Track` header and consent toggle.

---

## Third-Party Data Processors

| Processor | Data Shared | Purpose |
|-----------|-------------|---------|
| AWS S3 (Mumbai) | Temporary face image | Ephemeral storage during analysis |
| Anthropic (Claude) | Skin analysis text results, questionnaire | Recommendation generation — no images sent |
| Pinecone | Product text embeddings | Vector similarity search — no user data |
| SendGrid | Email address | Transactional email |
| Sentry | Error stack traces (no PII) | Error monitoring |
| PostHog | Anonymous usage events | Product analytics |

All processors are bound by DPAs. No user data is sold or shared for advertising.

---

## Incident Response

In the event of a data breach:
1. Affected users notified within **72 hours** (GDPR requirement).
2. India CERT-In notified within **6 hours** (IT Amendment Rules 2022).
3. Session tokens in Redis immediately revoked for affected users.
4. Post-incident report published to users within 30 days.
