#!/usr/bin/env bash
# Prints each SQL migration added or changed between two commits that holds a
# statement the release still serving might not survive (docs/infra.md,
# "Database migrations"): a drop, rename, type change, new NOT NULL on an
# existing column, or a bulk data change. Prints nothing when every new
# migration is additive. Usage: risky-migrations.sh <from-sha> <to-sha>
set -euo pipefail
pattern='\b(DROP|RENAME|TRUNCATE)\b|SET DATA TYPE|SET NOT NULL|DELETE FROM|^\s*UPDATE\b'
git diff --diff-filter=AMR --name-only "$1" "$2" -- 'apps/api/drizzle/*.sql' | while read -r file; do
  if git show "$2:${file}" | grep -qiE "${pattern}"; then
    echo "${file}"
  fi
done
