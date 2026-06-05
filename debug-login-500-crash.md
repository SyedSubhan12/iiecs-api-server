# [OPEN] Debug Session: login-500-crash

## Symptom
- Frontend login request returns `HTTP 500`.
- Vercel shows `FUNCTION_INVOCATION_FAILED`.
- `/api/healthz` also crashes with the same serverless error page.

## Initial Hypotheses
1. The serverless function crashes during module import because a dependency or built artifact cannot be resolved at runtime.
2. The function crashes before routing because the root Vercel entry file uses unsupported ESM/top-level-await behavior.
3. The function crashes when initializing database access because `DATABASE_URL` is missing or invalid.
4. The function crashes because the built server bundle imports packages that are not present in the deployed lambda.
5. The function starts, but the health/login route throws an uncaught error that is not being surfaced in the response.

## Evidence Plan
- Inspect the current Vercel entrypoint and build outputs.
- Add minimal runtime instrumentation to the entrypoint first.
- Rebuild locally to ensure instrumentation compiles.
- Ask the user to redeploy and reproduce so we can compare evidence.

## Evidence Collected
- `api/index.js` contained ESM syntax and top-level `await` while the root [package.json](file:///home/zaro/app_manager/package.json) does not declare `"type": "module"`.
- Running `node api/index.js` locally succeeded only after Node emitted a `MODULE_TYPELESS_PACKAGE_JSON` warning and reparsed the file as ESM.
- Running `node -e "import('./api/index.mjs')..."` succeeds with no module-type warning.
- Rebuilding [build.mjs](file:///home/zaro/app_manager/artifacts/api-server/build.mjs) still produces the server bundle successfully.

## Current Fix
- Replaced the Vercel entrypoint [index.js](file:///home/zaro/app_manager/api/index.js) with a plain CommonJS handler.
- The handler now imports the built app lazily inside the request and returns structured JSON if that import fails.
- Updated [vercel.json](file:///home/zaro/app_manager/vercel.json) to keep routing `/api/*` to the CommonJS entrypoint.

## Hypothesis Status
1. Dependency/built artifact resolution failure: still possible, not yet confirmed.
2. Vercel entry file uses unsupported module behavior: strongly supported by local evidence, and now mitigated by switching to CommonJS.
3. Database initialization crash: still possible after import succeeds.
4. Missing runtime packages in lambda: still possible, pending redeploy evidence.
5. Route-level uncaught exception: less likely than entrypoint failure because `/api/healthz` crashes before returning route output.
