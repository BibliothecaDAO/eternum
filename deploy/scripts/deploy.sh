#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --env <prod|preview> [--pr <number>] [--plan] [--skip-build] [--auto-approve] [--include-mobile]

Runs terraform for the requested environment and uploads the built assets to GCS.
Environment specific tfvars files live in deploy/terraform/environments.
USAGE
}

ENVIRONMENT="prod"
PR_NUMBER=""
TF_COMMAND="apply"
SKIP_BUILD=false
AUTO_APPROVE=false
INCLUDE_MOBILE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --pr)
      PR_NUMBER="$2"
      shift 2
      ;;
    --plan)
      TF_COMMAND="plan"
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --auto-approve)
      AUTO_APPROVE=true
      shift
      ;;
    --include-mobile)
      INCLUDE_MOBILE=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

ROOT_DIR=$(git rev-parse --show-toplevel)
TF_DIR="$ROOT_DIR/deploy/terraform"
ARTIFACT_ROOT="$ROOT_DIR/deploy/artifacts"
GENERATED_DIR="$TF_DIR/.generated"

mkdir -p "$GENERATED_DIR"

for bin in terraform gsutil jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Missing required dependency: $bin" >&2
    exit 1
  fi
done

if [[ "$SKIP_BUILD" == false ]]; then
  "$ROOT_DIR/deploy/scripts/build-static.sh" $( [[ "$INCLUDE_MOBILE" == true ]] && echo "--include-mobile" )
fi

TFVARS_PATH=""
case "$ENVIRONMENT" in
  prod)
    TFVARS_PATH="$TF_DIR/environments/prod/terraform.tfvars"
    if [[ ! -f "$TFVARS_PATH" ]]; then
      echo "Missing $TFVARS_PATH. Copy from terraform.tfvars.example and fill values." >&2
      exit 1
    fi
    ;;
  preview)
    if [[ -z "$PR_NUMBER" ]]; then
      echo "--pr is required when deploying preview environments" >&2
      exit 1
    fi

    TEMPLATE="$TF_DIR/environments/preview/terraform.tfvars.tmpl"
    if [[ ! -f "$TEMPLATE" ]]; then
      echo "Preview template $TEMPLATE not found" >&2
      exit 1
    fi

    PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
    if [[ -z "$PROJECT_ID" ]]; then
      echo "Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT for preview deploys" >&2
      exit 1
    fi

    DEFAULT_REGION="${DEFAULT_REGION:-us-central1}"
    DEFAULT_LOCATION="${DEFAULT_LOCATION:-US}"
    PREVIEW_BASE_DOMAIN="${PREVIEW_BASE_DOMAIN:?Set PREVIEW_BASE_DOMAIN (eg preview.example.com)}"
    PREVIEW_DNS_ZONE="${PREVIEW_DNS_ZONE:?Set PREVIEW_DNS_ZONE (Cloud DNS zone)}"
    PREVIEW_BUCKET_LOCATION="${PREVIEW_BUCKET_LOCATION:-$DEFAULT_LOCATION}"

    TFVARS_PATH="$GENERATED_DIR/preview-pr-${PR_NUMBER}.tfvars"
    sed \
      -e "s/__PROJECT_ID__/${PROJECT_ID}/g" \
      -e "s/__DEFAULT_REGION__/${DEFAULT_REGION}/g" \
      -e "s/__DEFAULT_LOCATION__/${DEFAULT_LOCATION}/g" \
      -e "s/__PREVIEW_BASE_DOMAIN__/${PREVIEW_BASE_DOMAIN}/g" \
      -e "s/__DNS_ZONE_NAME__/${PREVIEW_DNS_ZONE}/g" \
      -e "s/__BUCKET_LOCATION__/${PREVIEW_BUCKET_LOCATION}/g" \
      -e "s/__PR_NUMBER__/${PR_NUMBER}/g" \
      "$TEMPLATE" > "$TFVARS_PATH"

    PREVIEW_ENV_FILE="$ARTIFACT_ROOT/pr-${PR_NUMBER}.env"
    if [[ ! -f "$PREVIEW_ENV_FILE" ]]; then
      echo "Seeding $PREVIEW_ENV_FILE from deploy/templates/preview.env.stub"
      cp "$ROOT_DIR/deploy/templates/preview.env.stub" "$PREVIEW_ENV_FILE"
      echo "Fill preview env values in $PREVIEW_ENV_FILE before rerunning" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported environment: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

pushd "$TF_DIR" >/dev/null
terraform init

TF_ARGS=("$TF_COMMAND" "-var-file=$TFVARS_PATH")
if [[ "$TF_COMMAND" == "apply" && "$AUTO_APPROVE" == true ]]; then
  TF_ARGS+=("-auto-approve")
fi

terraform "${TF_ARGS[@]}"

if [[ "$TF_COMMAND" == "plan" ]]; then
  popd >/dev/null
  exit 0
fi

STATIC_SITES_JSON=$(terraform output -json static_sites)
popd >/dev/null

if [[ "$STATIC_SITES_JSON" == "null" ]]; then
  echo "No static sites returned from Terraform outputs" >&2
  exit 1
fi

UPLOAD_ENTRIES=$(echo "$STATIC_SITES_JSON" | jq -r 'to_entries[] | "\(.key) \(.value.bucket_name)"')

while read -r entry; do
  [[ -z "$entry" ]] && continue
  ENV_KEY=$(echo "$entry" | awk '{print $1}')
  BUCKET=$(echo "$entry" | awk '{print $2}')
  case "$ENV_KEY" in
    prod|preview)
      SOURCE_DIR="$ARTIFACT_ROOT/game-dist"
      ;;
    *)
      SOURCE_DIR="$ARTIFACT_ROOT/game-dist"
      ;;
  esac

  if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Source directory $SOURCE_DIR not found" >&2
    exit 1
  fi

  echo "Syncing $SOURCE_DIR to gs://$BUCKET"
  gsutil -m rsync -r "$SOURCE_DIR" "gs://$BUCKET"
done <<< "$UPLOAD_ENTRIES"

echo "Deployment complete. Domains:"
echo "$STATIC_SITES_JSON" | jq -r 'to_entries[] | " - \(.key): https://\(.value.domain)"'
