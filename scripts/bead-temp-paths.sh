#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <bead-id> [label]" >&2
  exit 1
fi

BEAD_ID="$1"
LABEL="${2:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/$BEAD_ID"

mkdir -p "$TMP_DIR"

path_for() {
  local name="$1"
  if [[ -n "$LABEL" ]]; then
    printf '%s/%s-%s\n' "$TMP_DIR" "$LABEL" "$name"
  else
    printf '%s/%s\n' "$TMP_DIR" "$name"
  fi
}

cat <<EOF
# usage:
#   eval "$($0 "$BEAD_ID" "$LABEL")"
export EE_BEAD_TMP_DIR=$(printf '%q' "$TMP_DIR")
export EE_BEAD_CMD_FILE=$(printf '%q' "$(path_for cmd)")
export EE_BEAD_LOG_FILE=$(printf '%q' "$(path_for log)")
export EE_BEAD_TIME_FILE=$(printf '%q' "$(path_for timelog)")
export EE_BEAD_TS_FILE=$(printf '%q' "$(path_for ts)")
export EE_BEAD_CASS_FILE=$(printf '%q' "$(path_for cass)")
export EE_BEAD_ARCHIVE_FILE=$(printf '%q' "$(path_for archive)")
EOF
