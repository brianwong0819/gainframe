#!/usr/bin/env bash
# Masks the Cognito user pool and client IDs in the rest of the job's log and
# appends them, one per line, to the file named by $1, so a plan comment can
# replace them too. The repository and its CI logs are public (CLAUDE.md,
# "Security"). Run after `terraform init` in an environment directory; before
# the first apply the outputs do not exist yet and nothing is masked.
set -euo pipefail
for name in auth_user_pool_id auth_client_id; do
  value="$(terraform output -raw "${name}" 2>/dev/null || true)"
  if [ -n "${value}" ]; then
    echo "::add-mask::${value}"
    echo "${value}" >> "$1"
  fi
done
