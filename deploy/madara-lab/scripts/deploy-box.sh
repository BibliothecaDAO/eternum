#!/usr/bin/env bash
# Redeploy the box's host services (herald, identity, launch, chat) from the deploy branch.
#
# This is the one redeploy recipe: the systemd units and the README point here instead of each
# carrying its own. `.github/workflows/deploy-box.yml` runs it on every push to `next` that
# touches a service; it can also be run by hand on the box as root:
#
#   sudo bash deploy/madara-lab/scripts/deploy-box.sh
#
# Only services whose inputs changed are restarted, because a herald restart drops every live game
# socket. The last line of output is one JSON result (event=box_deploy) that says what moved, what
# restarted, and what each health probe answered.
set -euo pipefail

REPO_DIR=/opt/realms/eternum
DEPLOY_BRANCH="${DEPLOY_BRANCH:-next}"
REALMS_PATH=/home/realms/.bun/bin:/usr/local/bin:/usr/bin:/bin
HEALTH_TIMEOUT_SECONDS=120

declare -A SERVICE_PORT=([herald]=3003 [realms-identity]=3000 [realms-launch]=3006 [realms-chat]=3005)
declare -A SERVICE_INPUTS=(
  [herald]='^(apps/herald/|packages/|pnpm-lock\.yaml$)'
  [realms-identity]='^(apps/realms/|packages/|pnpm-lock\.yaml$)'
  [realms-launch]='^(apps/launch-service/|packages/|pnpm-lock\.yaml$)'
  [realms-chat]='^(apps/realtime-server/|pnpm-lock\.yaml$)'
)

main() {
  require_root
  fetch_deploy_branch
  local from to
  from=$(repo rev-parse HEAD)
  to=$(repo rev-parse "origin/$DEPLOY_BRANCH")
  require_clean_worktree "$from"

  if [ "$from" = "$to" ]; then
    emit_result noop "$from" "$to" "" "" "$(probe_all_services)"
    return 0
  fi

  local changed
  changed=$(repo diff --name-only "$from" "$to")
  local services
  services=$(select_services_to_restart "$changed")

  checkout_deploy_branch
  install_workspace
  build_shared_packages
  for service in $services; do prepare_service "$service"; done
  for service in $services; do systemctl restart "$service"; done

  local health
  health=$(await_services_healthy "$services")
  local status
  status=$(restart_outcome "$services")
  emit_result "$status" "$from" "$to" "$changed" "$services" "$health"
  [ "$status" = ok ]
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "deploy-box.sh must run as root (it restarts systemd units)" >&2
    exit 1
  fi
}

as_realms() { sudo -u realms env PATH="$REALMS_PATH" "$@"; }
repo() { as_realms git -C "$REPO_DIR" "$@"; }

fetch_deploy_branch() { repo fetch --quiet origin "$DEPLOY_BRANCH"; }

require_clean_worktree() {
  local dirty
  dirty=$(repo status --porcelain --untracked-files=no)
  if [ -n "$dirty" ]; then
    emit_result failed "$1" "$1" "" "" '{}' "worktree has local modifications: $(echo "$dirty" | head -3 | tr '\n' ' ')"
    exit 1
  fi
}

# `checkout -B` moves the local branch onto origin, which also carries a box left on an old branch
# over to the deploy branch. The clean-worktree check above is what makes that safe.
checkout_deploy_branch() { repo checkout --quiet -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"; }

install_workspace() { as_realms pnpm --dir "$REPO_DIR" install --frozen-lockfile --silent; }

build_shared_packages() { as_realms pnpm --dir "$REPO_DIR" run build:packages >/dev/null; }

select_services_to_restart() {
  local changed=$1
  for service in herald realms-identity realms-launch realms-chat; do
    if echo "$changed" | grep -Eq "${SERVICE_INPUTS[$service]}"; then echo "$service"; fi
  done
}

# Identity is the one unit with build steps of its own: the SPA bundle and the session schema.
prepare_service() {
  if [ "$1" = realms-identity ]; then
    as_realms env DATABASE_SSL=false pnpm --dir "$REPO_DIR" --filter @realms-world/db push >/dev/null
    as_realms pnpm --dir "$REPO_DIR" --filter @realms-world/realms build >/dev/null
  fi
}

probe_service() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${SERVICE_PORT[$1]}/health" || true; }

probe_all_services() {
  local health=""
  for service in herald realms-identity realms-launch realms-chat; do
    health="$health,\"$service\":$(probe_service "$service" | sed 's/^$/0/')"
  done
  echo "{${health#,}}"
}

# Herald replays from its checkpoint before it listens, so a restart needs a real wait.
await_services_healthy() {
  local services=$1 deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local pending=0
    for service in $services; do [ "$(probe_service "$service")" = 200 ] || pending=1; done
    [ "$pending" -eq 0 ] && break
    sleep 3
  done
  probe_all_services
}

# Only the units this run restarted decide the outcome; the other probes are informational.
restart_outcome() {
  for service in $1; do [ "$(probe_service "$service")" = 200 ] || { echo failed; return; }; done
  echo ok
}

json_array() { printf '%s' "$1" | awk 'NF { printf "%s\"%s\"", (n++ ? "," : ""), $0 }' | sed 's/^/[/; s/$/]/'; }

emit_result() {
  local status=$1 from=$2 to=$3 changed=$4 restarted=$5 health=$6 error=${7:-}
  printf '{"event":"box_deploy","status":"%s","branch":"%s","from":"%s","to":"%s","changed":%s,"restarted":%s,"health":%s,"error":"%s"}\n' \
    "$status" "$DEPLOY_BRANCH" "${from:0:12}" "${to:0:12}" "$(json_array "$changed")" "$(json_array "$restarted")" "$health" "$error"
}

main "$@"
