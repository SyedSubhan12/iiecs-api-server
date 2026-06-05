---
name: Logout Mutation void args
description: useLogout() from the generated API client takes void — don't pass {}.
---

## Rule
```ts
// CORRECT
logoutMutation.mutate();

// WRONG — causes TS2345
logoutMutation.mutate({});
```

**Why:** Orval generates the logout mutation with a `void` body type since the OpenAPI spec has no request body for POST /auth/logout.
