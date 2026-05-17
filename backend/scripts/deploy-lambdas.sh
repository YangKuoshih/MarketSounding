#!/usr/bin/env bash
#
# Bundles each Lambda function with esbuild and deploys to AWS Lambda.
#
# Prerequisites:
#   - aws CLI configured with credentials
#   - Terraform stack already deployed (Lambda functions exist as placeholders)
#   - Run from backend/ directory
#
# Usage:
#   ./scripts/deploy-lambdas.sh [name_prefix]
#
# Example:
#   ./scripts/deploy-lambdas.sh marketsounding-dev

set -euo pipefail

NAME_PREFIX="${1:-marketsounding-dev}"
BUILD_DIR="dist-deploy"

# Map of Lambda function name suffix -> entry file
declare -A LAMBDAS=(
  ["auth"]="lambdas/auth/index.ts"
  ["research"]="lambdas/research/index.ts"
  ["simulation-kickoff"]="lambdas/simulation/kickoff.ts"
  ["dealer-agent"]="lambdas/dealer-agent/index.ts"
  ["write-round"]="lambdas/simulation/write-round.ts"
  ["init-simulation"]="lambdas/simulation/init.ts"
  ["complete-simulation"]="lambdas/simulation/complete.ts"
  ["graph-builder"]="lambdas/graph-builder/index.ts"
  ["graph-reader"]="lambdas/graph-reader/index.ts"
  ["chat-agent"]="lambdas/chat-agent/index.ts"
)

echo "Building and deploying Lambdas with prefix: $NAME_PREFIX"
echo

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

for SUFFIX in "${!LAMBDAS[@]}"; do
  ENTRY="${LAMBDAS[$SUFFIX]}"
  FUNC_NAME="${NAME_PREFIX}-${SUFFIX}"

  echo "==> $FUNC_NAME"
  echo "    Entry: $ENTRY"

  # Bundle with esbuild
  npx esbuild "$ENTRY" \
    --bundle \
    --platform=node \
    --target=node20 \
    --external:@aws-sdk/* \
    --outfile="$BUILD_DIR/${SUFFIX}/index.js" \
    --log-level=warning

  # Zip
  (cd "$BUILD_DIR/${SUFFIX}" && zip -q -r "../${SUFFIX}.zip" .)

  # Deploy
  aws lambda update-function-code \
    --function-name "$FUNC_NAME" \
    --zip-file "fileb://$BUILD_DIR/${SUFFIX}.zip" \
    --no-cli-pager > /dev/null

  echo "    Deployed."
  echo
done

echo "All Lambdas deployed successfully."
