# Data Privacy & Compliance

## Principles

This platform is designed with **privacy-by-default** for Indian users. Face images are treated as biometric data under India's **Digital Personal Data Protection (DPDP) Act 2023** and aligned with **GDPR** Article 9 (special category data) for global readiness.

---

## Image Data — Lifecycle

```
Capture ──▶ On-device TF.js analysis ──▶ 512-dim feature vector + labels sent to server
   0s              < 5s (browser/device only)              never leaves the device as an image
```

1. **The raw face image never reaches our servers, ever.** Skin analysis (skin type, tone, condition
   detection) runs entirely on-device in the browser via TensorFlow.js. Only the resulting 512-dimension
   feature vector and classification labels — never pixel data — are transmitted to the API
   (see `app/schemas/scan.py`: "Privacy contract: raw images are NEVER accepted by the API").
2. Every stored scan record is persisted with `image_permanently_deleted = TRUE`, since no image was ever
   received to begin with.
3. **Dermatologist reviewers see only the structured analysis results** (skin type, detected conditions,
   severities, confidence scores) — there is no image, blurred or otherwise, in the review queue.
4. An earlier design (presigned S3 PUT + server-side EXIF strip + face-blur-before-review) was superseded
   by the on-device architecture above and was never shipped; the corresponding upload/presign code path
   in `app/services/image_processor.py` exists but has no route wired to it and is not part of the live
   analysis flow.

---

## Personal Data Collected

| Data | Purpose | Retention | Deletable |
|------|---------|-----------|-----------|
| Email + password hash | Authentication | Until account deleted | Yes |
| Name, age, gender, city | Personalised recommendations | Until account deleted | Yes |
| Skin analysis results | Historical trend tracking | 2 years | Yes |
| Questionnaire answers | Recommendation context | 2 years | Yes |
| Progress photos | Optional self-tracking | Until user deletes | Yes — *planned; not yet implemented* |
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
| AI LLM Engine | Skin analysis text results, questionnaire | Recommendation generation — no images sent |
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
