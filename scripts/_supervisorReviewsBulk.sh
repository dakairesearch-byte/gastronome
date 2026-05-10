#!/usr/bin/env bash
# _supervisorReviewsBulk.sh
#
# Runs scrapeGoogleReviewsBulk.ts in a crash-resilient loop: if the scraper
# exits (for any reason — CAPTCHA, page-closed race, ECONNRESET, etc.) wait
# 5 minutes and re-launch. The bulk script itself is idempotent and resumable
# because each restaurant's scrape is persisted immediately and subsequent
# runs skip rows with >= MIN_CACHED reviews.
#
# Usage (from epicurious/): ./scripts/_supervisorReviewsBulk.sh

set -u

cd "$(dirname "$0")/.."

LOG="tmp/scrape_bulk_supervised.log"
RETRY_SLEEP_SECS=300   # 5 minutes between crashes

mkdir -p tmp

echo "=== Supervised run start $(date -u +%Y-%m-%dT%H:%M:%S%z) ===" >> "$LOG"

while true; do
  echo "=== slice start $(date -u +%Y-%m-%dT%H:%M:%S%z) ===" >> "$LOG"
  npx tsx scripts/scrapeGoogleReviewsBulk.ts >> "$LOG" 2>&1
  rc=$?
  echo "=== slice end rc=$rc $(date -u +%Y-%m-%dT%H:%M:%S%z) ===" >> "$LOG"
  if [ $rc -eq 0 ]; then
    echo "=== clean exit — bulk queue drained. supervisor stopping. ===" >> "$LOG"
    break
  fi
  echo "=== sleeping ${RETRY_SLEEP_SECS}s before retry ===" >> "$LOG"
  sleep "$RETRY_SLEEP_SECS"
done
