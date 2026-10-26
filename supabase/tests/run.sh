#!/usr/bin/env bash
# Roda as migrations num banco Postgres local descartável e executa os testes.
# Uso: npm run test:db   (requer psql e um Postgres local; PGHOST/PGUSER opcionais)
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="${TEST_DB:-escola_teste}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null

"${PSQL[@]}" -d "$DB" -f supabase/tests/stub_auth.sql >/dev/null
for f in supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done

"${PSQL[@]}" -o /dev/null -d "$DB" -f supabase/tests/permissoes.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
