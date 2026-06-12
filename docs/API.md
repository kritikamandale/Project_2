# API Reference

Base URL (dev): `http://localhost:8000/api/v1`
Interactive docs: `http://localhost:8000/docs` (Swagger UI, dev only)

All endpoints require `Authorization: Bearer <access_token>` unless marked **Public**.

---

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account — Public |
| POST | `/auth/login` | Email + password → JWT pair — Public |
| POST | `/auth/refresh` | Exchange refresh token → new access token — Public |
| POST | `/auth/logout` | Revoke refresh token |
| POST | `/auth/forgot-password` | Send OTP to email — Public |
| POST | `/auth/reset-password` | Confirm OTP + set new password — Public |

---

## Users

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/users/me` | Get own profile | USER+ |
| PATCH | `/users/me` | Update profile | USER+ |
| DELETE | `/users/me` | Delete account + all data | USER+ |
| GET | `/users` | List all users | ADMIN |
| GET | `/users/{id}` | Get user by ID | ADMIN |
| PATCH | `/users/{id}/role` | Change user role | ADMIN |

---

## Scan

| Method | Path | Description | Role |
|--------|------|-------------|------|
| POST | `/scan/upload-url` | Get presigned S3 PUT URL for image | USER+ |
| POST | `/scan/analyze` | Submit TF.js result + S3 key → start server analysis | USER+ |
| GET | `/scan/{id}` | Get scan status + results | USER+ |
| GET | `/scan/history` | List own scan history | USER+ |

---

## Questionnaire

| Method | Path | Description | Role |
|--------|------|-------------|------|
| POST | `/questionnaire` | Submit questionnaire for a scan | USER+ |
| GET | `/questionnaire/{scan_id}` | Retrieve submitted answers | USER+ |

---

## Recommendations

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/recommendations/{scan_id}` | Get full recommendation for a scan | USER+ |
| POST | `/recommendations/{scan_id}/regenerate` | Force re-run Claude engine | USER+ |
| GET | `/recommendations/{scan_id}/routine` | Get morning/night routine only | USER+ |

---

## Products

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/products` | List products (paginated, filterable) | USER+ |
| GET | `/products/{id}` | Get single product | USER+ |
| POST | `/products` | Add new product | ADMIN |
| PATCH | `/products/{id}` | Update product | ADMIN |
| DELETE | `/products/{id}` | Soft-delete product | ADMIN |
| POST | `/products/embed` | Rebuild Pinecone embeddings | ADMIN |

---

## Progress

| Method | Path | Description | Role |
|--------|------|-------------|------|
| POST | `/progress` | Log weekly progress entry | USER+ |
| GET | `/progress` | Get own progress timeline | USER+ |
| GET | `/progress/{id}` | Get single progress entry | USER+ |

---

## Dermatologist

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/dermatologist/queue` | List pending review cases | DERM+ |
| GET | `/dermatologist/case/{id}` | Get full case detail | DERM+ |
| POST | `/dermatologist/case/{id}/approve` | Approve recommendation | DERM+ |
| POST | `/dermatologist/case/{id}/modify` | Submit modified recommendation | DERM+ |
| POST | `/dermatologist/case/{id}/reject` | Reject + add notes | DERM+ |

---

## Admin

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/admin/stats` | Platform KPIs | ADMIN |
| GET | `/admin/users` | Full user list with filters | ADMIN |
| GET | `/admin/analytics/scans` | Scan volume over time | ADMIN |
| GET | `/admin/analytics/recommendations` | Top recommended products | ADMIN |
| POST | `/admin/settings` | Update platform feature flags | ADMIN |

---

## Error Format

```json
{
  "detail": "Human-readable error message",
  "code": "ERROR_CODE",
  "field": "field_name_if_validation_error"
}
```

Common HTTP status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `422` schema error, `429` rate limited, `500` server error.
