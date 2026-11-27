# Sandbox for command-center Kanban workers: Node 22 (npm, wrangler, workerd), git, gh.
# Only $CC_ROOT and the Kanban attachments dir are mounted in; nothing else from the host.
FROM node:22-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends gh jq \
 && rm -rf /var/lib/apt/lists/*

# Worktrees are owned by the host user (docker_run_as_host_user), so tell git they're safe.
RUN git config --system --add safe.directory '*'
