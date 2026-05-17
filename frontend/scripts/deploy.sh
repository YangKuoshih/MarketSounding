#!/usr/bin/env bash
#
# Build the Next.js static export and deploy to S3 + invalidate CloudFront.
#
# Required environment variables:
#   NEXT_PUBLIC_API_URL       API Gateway base URL
#   FRONTEND_BUCKET           S3 bucket name for frontend hosting
#   CLOUDFRONT_DISTRIBUTION_ID  CloudFront distribution to invalidate
#
# Usage:
#   ./scripts/deploy.sh

set -euo pipefail

: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL is required}"
: "${FRONTEND_BUCKET:?FRONTEND_BUCKET is required}"
: "${CLOUDFRONT_DISTRIBUTION_ID:?CLOUDFRONT_DISTRIBUTION_ID is required}"

echo "==> Building Next.js (static export)"
echo "    API URL: $NEXT_PUBLIC_API_URL"
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" npm run build

echo
echo "==> Syncing out/ to s3://$FRONTEND_BUCKET"
aws s3 sync out/ "s3://$FRONTEND_BUCKET" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --exclude "*.json"

# HTML and JSON should not be cached aggressively
aws s3 sync out/ "s3://$FRONTEND_BUCKET" \
  --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "*.json"

echo
echo "==> Invalidating CloudFront ($CLOUDFRONT_DISTRIBUTION_ID)"
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*" \
  --no-cli-pager > /dev/null

echo
echo "Deploy complete."
