#!/usr/bin/env bash
# ------------------------------------------------------------
# Upload all ID‑card PDFs from /home/zaro/app_manager/id_Cards
# into the `students` table (columns: id_card_pdf  (bytea),
#                         id_card_pdf_file_name (text),
#                         id_number (text) – used as the lookup key).
#
# Requirements:
#   • `psql` must be in your $PATH.
#   • The environment variable DATABASE_URL must contain a
#     Postgres connection string (e.g. postgres://user:pw@host/db).
#   • Filenames must contain the student ID in the form
#     IIECS‑<digits> (e.g.  IIECS‑12345_JohnDoe.pdf).
# ------------------------------------------------------------

set -euo pipefail

# ---- 1️⃣  Directory that holds the PDFs
ID_DIR="/home/zaro/app_manager/id_Cards"

# ---- 2️⃣  Make sure we have a DB URL
if [[ -z "${DATABASE_URL-}" ]]; then
  echo "❌  DATABASE_URL env var not set – aborting."
  exit 1
fi

# ---- 3️⃣  Helper: extract the IIECS‑xxxx part from a filename
extract_id() {
  # $1 = filename (no path)
  # returns the ID or empty string
  basename "$1" | grep -oE 'IIECS-[0-9]+' || true
}

# ---- 4️⃣  Iterate over PDFs
shopt -s nullglob                # no-match → empty list, no error
for pdf_path in "$ID_DIR"/*.pdf; do
  pdf_file=$(basename "$pdf_path")
  student_id=$(extract_id "$pdf_file")

  if [[ -z "$student_id" ]]; then
    echo "⚠️  Skipping $pdf_file – could not find IIECS‑ID in the name."
    continue
  fi

  # Encode the binary file as base64 – safe to pass via psql variable
  b64_data=$(base64 -w 0 "$pdf_path")

  # Run the UPDATE.  The `decode(...,'base64')` converts back to bytea.
  psql "$DATABASE_URL" <<SQL
\\set content '$b64_data'
UPDATE students
   SET id_card_pdf = decode(:'content', 'base64'),
       id_card_pdf_file_name = '$pdf_file'
 WHERE id_number = '$student_id';
SQL

  echo "✅  Updated student $student_id with $pdf_file"
done

echo "🎉  Finished – all PDFs processed."
