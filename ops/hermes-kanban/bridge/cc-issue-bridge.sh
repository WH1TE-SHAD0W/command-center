#!/usr/bin/env bash
# cc-issue-bridge — copies GitHub issues labelled `agent:ready` onto the Hermes Kanban board.
#
# Runs on the Hermes host as a script-only cron job (no LLM):
#   hermes cron create "every 15m" --no-agent --script cc-issue-bridge.sh --deliver telegram --name cc-issue-bridge
#
# Per issue it makes one git worktree and a chain of cards that share it:
#   developer -> tester -> documenter -> pr
# developer, tester and documenter end with a review by the `reviewer` profile
# (kanban_request_review); `pr` completes only when the PR's required checks pass.
#
# stdout is delivered to Telegram, so it prints issue numbers only, never issue text.
# An empty stdout is a silent run.
set -euo pipefail

ENV_FILE="${CC_BRIDGE_ENV:-$HOME/.config/command-center/bridge.env}"
# shellcheck source=/dev/null
. "$ENV_FILE"
: "${GH_TOKEN:?GH_TOKEN missing in $ENV_FILE}"
: "${CC_REPO:?CC_REPO (owner/name) missing in $ENV_FILE}"
: "${CC_ROOT:?CC_ROOT missing in $ENV_FILE}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID missing in $ENV_FILE}"
export GH_TOKEN

LABEL="${CC_TRIGGER_LABEL:-agent:ready}"
SKILL="${CC_WORKER_SKILL:-command-center-worker}"
REPO_DIR="$CC_ROOT/repo"
WT_ROOT="$CC_ROOT/worktrees"
mkdir -p "$WT_ROOT"

# One run at a time.
exec 9>"$CC_ROOT/.bridge.lock"
flock -n 9 || exit 0

for bin in gh git jq hermes flock; do
  command -v "$bin" >/dev/null || { echo "cc-issue-bridge: $bin not on PATH" >&2; exit 1; }
done

ensure_repo() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    git clone --quiet "https://github.com/$CC_REPO.git" "$REPO_DIR"
  fi
  git -C "$REPO_DIR" fetch --quiet --prune origin
}

branch_type() { # $1 = space-separated label names
  case " $1 " in
    *" type:bug "*) echo fix ;;
    *" type:chore "*) echo chore ;;
    *) echo feat ;;
  esac
}

slugify() {
  local s
  s=$(printf '%s' "$1" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null) || s=$1
  printf '%s' "$s" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-40 \
    | sed -E 's/-+$//'
}

ensure_worktree() { # $1 = worktree path, $2 = branch
  [ -d "$1" ] && return 0
  if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$2"; then
    git -C "$REPO_DIR" worktree add --quiet "$1" "$2"
  elif git -C "$REPO_DIR" show-ref --verify --quiet "refs/remotes/origin/$2"; then
    git -C "$REPO_DIR" worktree add --quiet -b "$2" "$1" "origin/$2"
  else
    git -C "$REPO_DIR" worktree add --quiet -b "$2" "$1" origin/main
  fi
}

# card <role> <parent-id|""> <body-file> <issue-number> <worktree> [extra hermes args...]
card() {
  local role=$1 parent=$2 body=$3 n=$4 wt=$5
  shift 5
  local args=(kanban create "#$n $role: $TITLE"
    --assignee "$role"
    --workspace "dir:$wt"
    --skill "$SKILL"
    --body "$(cat "$body")"
    --idempotency-key "cc-gh-$n-$role"
    --max-retries 2
    --json)
  [ -n "$parent" ] && args+=(--parent "$parent")
  args+=("$@")
  hermes "${args[@]}" | jq -r .id
}

write_body() { # $1 = role, $2 = out file
  {
    printf 'GitHub issue: #%s %s\n' "$N" "$TITLE"
    printf 'URL: %s\n' "$URL"
    printf 'Repository: %s\n' "$CC_REPO"
    printf 'Worktree: %s (branch %s, already checked out)\n' "$WT" "$BRANCH"
    printf 'Your role: %s. Load the %s skill and follow its "%s" section.\n\n' "$1" "$SKILL" "$1"
    printf -- '--- Issue body (the acceptance criteria here are the source of truth) ---\n'
    printf '%s\n' "$BODY"
  } >"$2"
}

import_issue() { # $1 = issue JSON
  N=$(jq -r .number <<<"$1")
  TITLE=$(jq -r .title <<<"$1")
  URL=$(jq -r .url <<<"$1")
  BODY=$(jq -r '.body // ""' <<<"$1")
  local labels
  labels=$(jq -r '[.labels[].name] | join(" ")' <<<"$1")

  local slug
  slug=$(slugify "$TITLE")
  BRANCH="$(branch_type "$labels")/$N-${slug:-issue}"
  WT="$WT_ROOT/$N"
  ensure_worktree "$WT" "$BRANCH"

  local tmp
  tmp=$(mktemp -d)

  local role ids=() parent=""
  for role in developer tester documenter; do
    write_body "$role" "$tmp/$role.md"
    parent=$(card "$role" "$parent" "$tmp/$role.md" "$N" "$WT")
    ids+=("$parent")
  done
  write_body pr "$tmp/pr.md"
  ids+=("$(card pr "$parent" "$tmp/pr.md" "$N" "$WT" --completion-contract "$CC_REPO")")
  rm -rf "$tmp"

  local id
  for id in "${ids[@]}"; do
    hermes kanban notify-subscribe "$id" --platform telegram --chat-id "$TELEGRAM_CHAT_ID" >/dev/null
  done

  # Hand the issue over: agent:ready (+ status:ready) -> status:in-progress.
  gh issue edit "$N" --repo "$CC_REPO" --add-label status:in-progress --remove-label "$LABEL" >/dev/null
  case " $labels " in
    *" status:ready "*) gh issue edit "$N" --repo "$CC_REPO" --remove-label status:ready >/dev/null ;;
  esac

  printf 'queued #%s on %s\n' "$N" "$BRANCH"
}

# Best effort: mirror blocked cards to status:blocked on the issue.
# `hermes kanban list --json` output shape is not documented; this expects an array (or
# {tasks:[...]}) of objects with .title and .status. It never fails the run.
sync_blocked() {
  local json
  json=$(hermes kanban list --json 2>/dev/null) || return 0
  jq -r '(if type=="array" then . else (.tasks // []) end)[]
         | select(.status=="blocked") | .title' <<<"$json" 2>/dev/null \
    | sed -nE 's/^#([0-9]+) .*/\1/p' | sort -u \
    | while read -r n; do
        if gh issue view "$n" --repo "$CC_REPO" --json labels -q '[.labels[].name] | index("status:blocked")' \
             | grep -qx null; then
          gh issue edit "$n" --repo "$CC_REPO" --add-label status:blocked >/dev/null || true
          printf 'blocked #%s (see the card on the board)\n' "$n"
        fi
      done
}

ensure_repo

gh issue list --repo "$CC_REPO" --state open --label "$LABEL" \
  --json number,title,url,body,labels --limit 20 \
  | jq -c 'sort_by(.number)[]' \
  | while read -r issue; do import_issue "$issue"; done

sync_blocked
