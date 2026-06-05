# [OPEN] Debug Session: qr-scan-student-not-found

## Symptom
- Scanning valid student QR codes returns "student not found for this QR code".
- The QR payloads are embedded in official student ID card PDF files.
- The task also requires syncing newly added ID card PDFs into the database.

## Scope
- QR code generation format
- QR scanner parsing
- Attendance API lookup logic
- ID card folder sync pipeline

## Initial Hypotheses
1. The scanner receives QR payloads whose `id` or `idNumber` format does not exactly match the database values used by the API lookup.
2. Some newer student PDFs exist in the ID card folder but their student records or `qrCodeData` were never seeded into the database.
3. The attendance scan route falls back incorrectly when JSON parsing fails or when the QR contains a URL/raw text variant rather than the expected JSON object.
4. PDF-extracted QR content and database-stored `qrCodeData` have drifted, so the scanner decodes one format while the API expects another.
5. The issue is data-specific: existing students work only when their IDs were seeded earlier, while new PDFs are missing or partially synced.

## Evidence Plan
- Inspect current QR parsing/generation code and the seed/import pipeline.
- Instrument the attendance scan endpoint first to capture incoming payload shape and lookup decisions.
- Compare PDF-derived student identifiers with database-ready fields.
- Reproduce locally with sample payloads before implementing a minimal fix.
