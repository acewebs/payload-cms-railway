#!/usr/bin/env bash
#
# Creates the storage bucket for this project and wires its credentials into the
# Payload service.
#
# Why this is not in .railway/railway.ts: as of Railway CLI 5.49.2, a bucket()
# declared there reports "applied" and then does not exist, leaving every S3_*
# reference resolving to an empty string. Payload would fall back to disk and
# uploads would vanish on the next deploy. The CLI's own bucket command works, so
# the bucket is created here and the IaC file marks the five variables preserve()
# so it will not overwrite them.
#
# Retry bucket() in the IaC file once Railway fixes it; passing an explicit region
# there is untested and might be all it needs.
#
# Usage:  scripts/railway-bucket.sh [region]
#         region is one of sjc (US West), iad (US East), ams (EU West), sin (Asia
#         Pacific). It cannot be changed after the bucket is created.

set -euo pipefail

SERVICE="${SERVICE:-Payload CMS}"
RAILWAY="${RAILWAY:-railway}"
# Defaults to the region declared in .railway/railway.ts. Keep them in step.
REGION="${1:-ams}"

if ! command -v "$RAILWAY" >/dev/null 2>&1; then
  echo "error: the railway CLI is not on PATH. See https://docs.railway.com/cli" >&2
  exit 1
fi

bucket_names() {
  "$RAILWAY" bucket list --json 2>/dev/null |
    python3 -c 'import json,sys; print("\n".join(b["name"] for b in json.load(sys.stdin)))'
}

before="$(bucket_names || true)"

echo "==> creating bucket"
if [ -n "$REGION" ]; then
  "$RAILWAY" bucket create --region "$REGION"
else
  "$RAILWAY" bucket create
fi

# Railway generates the bucket's name; the one passed on the command line is
# ignored. Find it by diffing against what existed a moment ago.
after="$(bucket_names)"
name="$(comm -13 <(printf '%s\n' "$before" | sort) <(printf '%s\n' "$after" | sort) | head -1)"

if [ -z "$name" ]; then
  echo "error: could not work out the new bucket's name. Check 'railway bucket list'." >&2
  exit 1
fi

# Match the name .railway/railway.ts declares, so a later `railway config apply`
# adopts this bucket rather than offering to delete it.
if [ "$name" != "Bucket" ]; then
  echo "==> renaming $name to Bucket"
  "$RAILWAY" bucket rename -b "$name" -n Bucket
  name="Bucket"
fi

echo "==> wiring $name into '$SERVICE'"
"$RAILWAY" variables --service "$SERVICE" --skip-deploys \
  --set "S3_BUCKET=\${{$name.BUCKET}}" \
  --set "S3_ENDPOINT=\${{$name.ENDPOINT}}" \
  --set "S3_REGION=\${{$name.REGION}}" \
  --set "S3_ACCESS_KEY_ID=\${{$name.ACCESS_KEY_ID}}" \
  --set "S3_SECRET_ACCESS_KEY=\${{$name.SECRET_ACCESS_KEY}}"

echo
echo "Done. Redeploy the service to pick the variables up:"
echo "    railway redeploy --service '$SERVICE'"
