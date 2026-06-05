---
name: IIECS Auth Pattern
description: How authentication works in this app — email-only, role from DB, stored in localStorage.
---

## Rule
No passwords. Email alone determines role.

- Admin emails: `admin@iiecs.edu`, `teacher@iiecs.edu` (hardcoded in `artifacts/api-server/src/routes/auth.ts`)
- Student emails: looked up in the `students` table by email
- Session stored in `localStorage` key `iiecs_user` as `{ email, role, studentId?, name? }`

**Why:** Simple institutional setup; no password management needed; students are pre-enrolled by admin.

**How to apply:** When adding protected routes, check `localStorage` via `AuthContext`. Backend routes do NOT enforce auth headers for data queries (auth is client-side). The `/api/auth/me` endpoint reads `x-user-email` header but is not required by other routes.
