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
DEPLOY_STEP=startup
DEPLOYED_REF=refs/deployments/box

declare -A SERVICE_PORT=([herald]=3003 [realms-identity]=3000 [realms-launch]=3006 [realms-chat]=3005)

main() {
  trap report_failure EXIT
  require_root
  run_step fetch_deploy_branch
  local from to
  from=$(repo rev-parse --verify "$DEPLOYED_REF" 2>/dev/null || true)
  to=$(repo rev-parse "origin/$DEPLOY_BRANCH")
  run_step require_clean_worktree "$(repo rev-parse HEAD)"

  if [ "$from" = "$to" ]; then
    emit_result noop "$from" "$to" "" "" "$(probe_all_services)"
    return 0
  fi

  local changed="" services plan build_shared
  if [ -n "$from" ]; then
    changed=$(repo diff --name-only "$from" "$to")
  fi

  run_step checkout_deploy_branch "$to"
  DEPLOY_STEP=plan
  plan=$(as_realms bun "$REPO_DIR/deploy/madara-lab/scripts/deploy-box-plan.mjs" "$from" "$to")
  services=$(read_plan_field "$plan" services)
  build_shared=$(read_plan_field "$plan" buildShared)
  printf '[box-deploy] plan %s\n' "$plan"
  if [ -n "$services" ]; then run_step install_workspace; fi
  if [ "$build_shared" = true ]; then run_step build_shared_packages; fi
  for service in $services; do run_step prepare_service "$service"; done
  for service in $services; do run_step systemctl restart "$service"; done

  local health
  DEPLOY_STEP=health
  health=$(await_services_healthy "$services")
  local status
  status=$(restart_outcome "$services")
  if [ "$status" = ok ]; then run_step repo update-ref "$DEPLOYED_REF" "$to"; fi
  emit_result "$status" "$from" "$to" "$changed" "$services" "$health"
  [ "$status" = ok ]
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "deploy-box.sh must run as root (it restarts systemd units)" >&2
    exit 1
  fi
}

as_realms() { (cd "$REPO_DIR" && sudo -u realms env PATH="$REALMS_PATH" "$@"); }
repo() { as_realms git -C "$REPO_DIR" "$@"; }

run_step() {
  DEPLOY_STEP="$*"
  printf '[box-deploy] %s\n' "$DEPLOY_STEP"
  "$@"
}

report_failure() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    printf '{"event":"box_deploy","status":"failed","step":"%s","exitCode":%d}\n' "$DEPLOY_STEP" "$status"
  fi
}

read_plan_field() {
  printf '%s' "$1" | python3 -c 'import json,sys; value=json.load(sys.stdin)[sys.argv[1]]; print("\n".join(value) if isinstance(value,list) else str(value).lower())' "$2"
}

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
checkout_deploy_branch() { repo checkout --quiet -B "$DEPLOY_BRANCH" "$1"; }

install_workspace() { as_realms pnpm --dir "$REPO_DIR" install --frozen-lockfile --reporter=append-only; }

build_shared_packages() { as_realms pnpm --dir "$REPO_DIR" run build:packages; }

# Identity is the one unit with build steps of its own: the SPA bundle and the session schema.
prepare_service() {
  if [ "$1" = realms-identity ]; then
    as_realms env DATABASE_SSL=false pnpm --dir "$REPO_DIR" --filter @realms-world/db push
    as_realms pnpm --dir "$REPO_DIR" --filter @realms-world/realms build
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

json_array() { printf '%s' "$1" | awk 'BEGIN { printf "[" } NF { printf "%s\"%s\"", (n++ ? "," : ""), $0 } END { print "]" }'; }

emit_result() {
  local status=$1 from=$2 to=$3 changed=$4 restarted=$5 health=$6 error=${7:-}
  printf '{"event":"box_deploy","status":"%s","branch":"%s","from":"%s","to":"%s","changed":%s,"restarted":%s,"health":%s,"error":"%s"}\n' \
    "$status" "$DEPLOY_BRANCH" "${from:0:12}" "${to:0:12}" "$(json_array "$changed")" "$(json_array "$restarted")" "$health" "$error"
}

main "$@"
