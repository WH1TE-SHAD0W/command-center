#!/usr/bin/env bash
# One-time setup on the Hermes host. Re-runnable: existing profile configs are backed up first.
#   GIT_EMAIL=<commit address for agent commits> CC_ROOT=/srv/command-center ./setup.sh
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
: "${GIT_EMAIL:?set GIT_EMAIL to the address agent commits use}"
: "${CC_ROOT:=/srv/command-center}"
HERMES_HOME_DIR="${HERMES_HOME:-$HOME/.hermes}"
SKILLS_DIR="$HERMES_HOME_DIR/skills-command-center"
ROLES=(developer tester documenter reviewer pr)

mkdir -p "$CC_ROOT/worktrees" "$CC_ROOT/.npm-cache" "$SKILLS_DIR" \
         "$HERMES_HOME_DIR/kanban/attachments" "$HERMES_HOME_DIR/scripts" \
         "$HOME/.config/command-center"

# 1. Sandbox image.
docker build -t command-center-worker:latest "$HERE/docker"

# 2. Shared worker skill (loaded via skills.external_dirs).
rm -rf "$SKILLS_DIR/command-center-worker"
cp -r "$HERE/skills/command-center-worker" "$SKILLS_DIR/"

# 3. One profile per role.
for role in "${ROLES[@]}"; do
  dir="$HERMES_HOME_DIR/profiles/$role"
  [ -d "$dir" ] || hermes profile create "$role" --no-alias --description "command-center $role worker"
  [ -f "$dir/config.yaml" ] && cp "$dir/config.yaml" "$dir/config.yaml.bak.$(date +%Y%m%d%H%M%S)"
  if [ "$role" = pr ]; then fwd='docker_forward_env: ["GH_TOKEN"]'; else fwd='docker_forward_env: []'; fi
  sed -e "s|__CC_ROOT__|$CC_ROOT|g" \
      -e "s|__HERMES_HOME__|$HERMES_HOME_DIR|g" \
      -e "s|__GIT_EMAIL__|$GIT_EMAIL|g" \
      -e "s|__SKILLS_DIR__|$SKILLS_DIR|g" \
      -e "s|__FORWARD_ENV__|$fwd|" \
      "$HERE/profiles/worker.config.yaml" >"$dir/config.yaml"
  sed -e "s|__ROLE__|$role|g" "$HERE/profiles/SOUL.md" >"$dir/SOUL.md"
done

# 4. Bridge script + its env file.
install -m 755 "$HERE/bridge/cc-issue-bridge.sh" "$HERMES_HOME_DIR/scripts/cc-issue-bridge.sh"
if [ ! -f "$HOME/.config/command-center/bridge.env" ]; then
  install -m 600 "$HERE/bridge/bridge.env.example" "$HOME/.config/command-center/bridge.env"
  echo "Fill in $HOME/.config/command-center/bridge.env"
fi

cat <<EOF

Done. Still to do by hand:
  1. GEMINI_API_KEY in each profile's .env (hermes profile create copies the current profile's keys):
       grep -l GEMINI_API_KEY $HERMES_HOME_DIR/profiles/*/.env
  2. GH_TOKEN (this repo only: Contents RW, Pull requests RW, Issues RW, no admin) in
       $HERMES_HOME_DIR/profiles/pr/.env
  3. Merge profiles/kanban.default.yaml into $HERMES_HOME_DIR/config.yaml, then: hermes gateway restart
  4. hermes cron create "every 15m" --no-agent --script cc-issue-bridge.sh --deliver telegram --name cc-issue-bridge
EOF
