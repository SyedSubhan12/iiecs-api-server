# IIECS-101 Attendance & Invoice Management System

A full-stack web app for managing attendance and payments for a C/C++ Algorithms course (Batch B) at IIECS Institute.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm --filter @workspace/attendance-app run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed sample students, attendance, payments, invoices
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (navy + gold theme)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Routing: Wouter
- Build: esbuild (CJS bundle)
- QR scanning: html5-qrcode

## Where things live

- `lib/db/src/schema/` — DB tables: students, admins, attendance, payments, invoices
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers (auth, students, attendance, payments, invoices, dashboard)
- `artifacts/attendance-app/src/pages/` — all frontend pages
- `artifacts/attendance-app/src/contexts/AuthContext.tsx` — auth state (localStorage-based)
- `scripts/src/seed.ts` — seed script for sample data

## Architecture decisions

- **Email-only auth**: No passwords. Admin emails hardcoded (`admin@iiecs.edu`, `teacher@iiecs.edu`). Students matched by DB lookup. Role stored in `localStorage` as `iiecs_user`.
- **Contract-first API**: OpenAPI spec drives Orval codegen. All hooks import from `@workspace/api-client-react`.
- **QR code data format**: `{"id":"...","name":"...","email":"...","idNumber":"...","batch":"...","enrollmentDate":"..."}` stored as `qrCodeData` on each student.
- **Attendance scan flow**: `POST /api/attendance/scan` validates QR → returns student info + today's record. Then `POST /api/attendance` marks it.
- **Invoice PDF**: Uses browser `window.open()` + `window.print()` with inline HTML. No server-side PDF generation needed.

## Product

- **Admin role**: Dashboard with live stats, QR scanner for attendance, attendance records with edit, student management with progress view, payment management with mark-paid action, monthly reports with bar chart.
- **Student role**: Personal dashboard with attendance %, full attendance history, payment history with invoices, downloads page for printable ID card and invoice PDFs.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Route ordering in Express: `/attendance/scan` and `/attendance/report/monthly` must come BEFORE `/:id` in attendance router.
- `/students/by-email/:email` must come before `/students/:id`.
- The `html5-qrcode` library needs a DOM element with `id="qr-reader"` present before calling `Html5Qrcode("qr-reader")`.
- Seed script: run `pnpm --filter @workspace/scripts run seed` (not `npx tsx`). `drizzle-orm` must be in scripts dependencies.
- `useLogout().mutate()` takes no arguments (void mutation) — do NOT pass `{}`.
- The Vite config requires `PORT` and `BASE_PATH` env vars — don't run `pnpm dev` from the root.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
