#!/usr/bin/env bash
# Builds/tags the two custom images and pushes them to ECR.
# - katana: spike Dockerfile (rc.9 + vrf-server source build + paymaster v0.2.4)
# - torii:  spike docker/torii (v1.8.16 + multi-world GraphQL and dynamic
#           contract patches; stage it with spike/scripts/build-torii.sh first)
# Usage: AWS_PROFILE=realms-appchain scripts/push-images.sh
set -euo pipefail

CDK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE_DIR="$CDK_DIR/../spike"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

KATANA_TAG="rc9-vrf-paymaster-v1"   # keep in sync with lib/config.ts
TORII_TAG="1.8.16-mw-dynamic-v5"

aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY"

docker build -t "$REGISTRY/realms-appchain/katana:$KATANA_TAG" "$SPIKE_DIR/docker/katana"

[ -f "$SPIKE_DIR/docker/torii/torii" ] || {
  echo "patched torii binary missing — run spike/scripts/build-torii.sh first" >&2
  exit 1
}
docker build -t "$REGISTRY/realms-appchain/torii:$TORII_TAG" "$SPIKE_DIR/docker/torii"

docker push "$REGISTRY/realms-appchain/katana:$KATANA_TAG"
docker push "$REGISTRY/realms-appchain/torii:$TORII_TAG"
echo "pushed: $KATANA_TAG, $TORII_TAG"
