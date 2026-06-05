---
name: QR Code Data Format
description: The JSON shape stored in student.qrCodeData and parsed by the scanner.
---

## Format
```json
{"id":"<uuid>","name":"<fullName>","email":"<email>","idNumber":"<idNumber>","batch":"<batch>","enrollmentDate":"YYYY-MM-DD"}
```

## Scan Flow
1. `POST /api/attendance/scan` with `{ qrData: rawString }` → returns `{ student, alreadyMarkedToday, todayRecord }`
2. Admin reviews student info on screen
3. Click "Mark Present" or "Mark Late" → `POST /api/attendance` with `{ studentId, status }`

**Why:** Self-contained QR so the scanner works offline/before DB lookup confirms the data.
