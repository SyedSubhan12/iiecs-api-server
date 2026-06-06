---
name: payment-security-fix
description: Fix authentication and authorization issues in bulk delete payment functionality
source: auto-skill
extracted_at: '2026-06-06T05:53:17.045Z'
---

# Fixing Authentication and Authorization in Bulk Delete Payment Functionality

## Problem Identification
When working with the delete all payment functionality in an Express.js application, I discovered critical security vulnerabilities:

1. **Missing Authentication**: The DELETE endpoint had no authentication checks
2. **Missing Authorization**: No verification that users had admin privileges
3. **No Error Handling**: No proper error handling for database operations
4. **Inconsistent Security**: Similar issues existed in other bulk delete endpoints

## Solution Approach

### Step 1: Add Authentication Function
```javascript
const ADMIN_EMAILS = ["admin@iiecs.edu", "teacher@iiecs.edu"];

async function getAuthContext(req: {
  headers: Record<string, unknown>;
}): Promise<{ role: "admin" | "student"; email: string; studentId: string | null } | null> {
  const raw = req.headers["x-user-email"];
  const email = typeof raw === "string" ? raw.toLowerCase().trim() : null;
  if (!email) return null;

  if (ADMIN_EMAILS.includes(email)) {
    return { role: "admin", email, studentId: null };
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, email))
    .limit(1);

  if (student) {
    return { role: "student", email, studentId: student.id };
  }

  return null;
}
```

### Step 2: Secure the Delete Endpoint
```javascript
router.delete("/payments", async (req, res) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (auth.role !== "admin") {
      res.status(403).json({ error: "Unauthorized - Admin access required" });
      return;
    }

    const result = await db.delete(paymentsTable).returning({ id: paymentsTable.id });
    res.json({ deleted: result.length });
  } catch (error) {
    console.error("Error deleting all payments:", error);
    res.status(500).json({ error: "Failed to delete payments" });
  }
});
```

### Step 3: Apply Consistent Security
- Apply the same pattern to all bulk delete endpoints (attendance, invoices, etc.)
- Ensure all admin-only operations follow this pattern
- Add appropriate error logging for debugging

## Implementation Details

### Key Security Principles Applied:
1. **Authentication First**: Verify user identity before any operation
2. **Authorization Second**: Check user has required permissions
3. **Error Handling**: Wrap database operations in try-catch blocks
4. **Proper HTTP Status Codes**: Use 401 for auth failures, 403 for permission issues

### Common Pitfalls to Avoid:
- Never expose endpoints without authentication
- Don't rely solely on frontend security
- Always validate server-side permissions
- Handle database errors gracefully

### Best Practices:
1. **Centralize Auth Logic**: Create a reusable authentication function
2. **Consistent Error Responses**: Standardize error message formats
3. **Audit Trail**: Log authentication attempts and critical operations
4. **Environment Variables**: Store admin emails in config rather than hardcoding

This approach ensures that bulk delete operations are secure, auditable, and maintainable while providing clear feedback to users when authorization fails.