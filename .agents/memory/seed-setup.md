---
name: Seed Script Setup
description: How to run the DB seed script correctly in this monorepo.
---

## Rule
- Seed script lives in `scripts/src/seed.ts`
- Run via: `pnpm --filter @workspace/scripts run seed`
- Do NOT use `npx tsx scripts/src/seed.ts` — it can't resolve `@workspace/db`
- `drizzle-orm` must be in `scripts/package.json` `dependencies` (not just a transitive dep)
- Use `onConflictDoNothing()` on invoice inserts to avoid duplicate key errors on re-runs

**Why:** pnpm workspace resolution doesn't work with npx tsx; the scripts package needs explicit deps.
