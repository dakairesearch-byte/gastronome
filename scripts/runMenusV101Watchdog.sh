#!/bin/bash
# Watchdog runner for scrapeMenusV101.ts.
#
# Shard-aware variant of v100's watchdog. Derives HEARTBEAT/LOGDIR/tag from
# the --shardIndex/--shardCount args so multiple shards can each have their
# own watchdog without clobbering each other.
#
# Usage:
#   bash scripts/runMenusV101Watchdog.sh --idsFile=tmp/no-menu-priority-ids.txt
#   bash scripts/runMenusV101Watchdog.sh --idsFile=... --shardIndex=0 --shardCount=5
#
# Env overrides:
#   POLL_SEC=10
#   STALE_SEC=120
#   MAX_RESTARTS=20

set -u
cd "$(dirname "$0")/.."

POLL_SEC=${POLL_SEC:-10}
STALE_SEC=${STALE_SEC:-120}
MAX_RESTARTS=${MAX_RESTARTS:-20}

# Parse --shardIndex / --shardCount out of args to derive filenames.
# We still pass every arg through to the child unchanged.
SHARD_INDEX=0
SHARD_COUNT=1
for arg in "$@"; do
  case "$arg" in
    --shardIndex=*) SHARD_INDEX="${arg#--shardIndex=}" ;;
    --shardCount=*) SHARD_COUNT="${arg#--shardCount=}" ;;
  esac
done
if [[ "$SHARD_COUNT" -gt 1 ]]; then
  TAG="shard-${SHARD_INDEX}-of-${SHARD_COUNT}"
  SUFFIX="-shard-${SHARD_INDEX}-of-${SHARD_COUNT}"
else
  TAG="single"
  SUFFIX=""
fi

HEARTBEAT="tmp/v101-heartbeat${SUFFIX}.json"
LOGDIR="tmp/v101-watchdog-logs"
mkdir -p "$LOGDIR"
export TMPDIR=/sessions/amazing-compassionate-lovelace/tmp/pw-artifacts
mkdir -p "$TMPDIR"

RUN_ID=$(date +%Y%m%d-%H%M%S)
MASTER_LOG="$LOGDIR/watchdog-$TAG-$RUN_ID.log"
echo "[$(date +%H:%M:%S)] [$TAG] watchdog start run=$RUN_ID args=$*" | tee -a "$MASTER_LOG"

child_pid=0
restarts=0
cleanup() {
  if [[ $child_pid -gt 0 ]] && kill -0 "$child_pid" 2>/dev/null; then
    echo "[$(date +%H:%M:%S)] [$TAG] cleanup: sending SIGTERM to child $child_pid" | tee -a "$MASTER_LOG"
    kill -TERM "$child_pid" 2>/dev/null
    sleep 3
    kill -9 "$child_pid" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

launch_child() {
  local log="$LOGDIR/v101-$TAG-$RUN_ID-attempt-$restarts.log"
  echo "[$(date +%H:%M:%S)] [$TAG] launching v101 (attempt $restarts) -> $log" | tee -a "$MASTER_LOG"
  nohup npx tsx scripts/scrapeMenusV101.ts "$@" > "$log" 2>&1 &
  child_pid=$!
  echo "[$(date +%H:%M:%S)] [$TAG] child pid=$child_pid" | tee -a "$MASTER_LOG"
  local waited=0
  while [[ ! -f "$HEARTBEAT" && $waited -lt 30 ]]; do
    sleep 2; waited=$((waited+2))
  done
  if [[ ! -f "$HEARTBEAT" ]]; then
    echo "[$(date +%H:%M:%S)] [$TAG] WARN: no heartbeat after 30s" | tee -a "$MASTER_LOG"
  fi
}

is_done() {
  [[ -f "$HEARTBEAT" ]] || return 1
  python3 - <<PY "$HEARTBEAT"
import json, sys
try:
    h = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
phase = h.get('phase', '')
idx = h.get('idx', 0)
total = h.get('total', 0)
if total == 0:
    sys.exit(0)
if phase in ('idle', 'finalize') and idx == total:
    sys.exit(0)
sys.exit(1)
PY
}

heartbeat_age_seconds() {
  [[ -f "$HEARTBEAT" ]] || { echo 9999; return; }
  local beat_iso
  beat_iso=$(python3 -c "import json; print(json.load(open('$HEARTBEAT'))['last_beat'])" 2>/dev/null || echo "")
  [[ -z "$beat_iso" ]] && { echo 9999; return; }
  python3 -c "
import json, datetime
with open('$HEARTBEAT') as f: s = json.load(f)['last_beat']
t = datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
now = datetime.datetime.now(datetime.timezone.utc)
print(int((now - t).total_seconds()))
" 2>/dev/null || echo 9999
}

launch_child "$@"

while [[ $restarts -lt $MAX_RESTARTS ]]; do
  sleep "$POLL_SEC"

  if ! kill -0 "$child_pid" 2>/dev/null; then
    if is_done; then
      echo "[$(date +%H:%M:%S)] [$TAG] child exited and heartbeat says idle — DONE" | tee -a "$MASTER_LOG"
      break
    fi
    echo "[$(date +%H:%M:%S)] [$TAG] child $child_pid died without completing — relaunching" | tee -a "$MASTER_LOG"
    restarts=$((restarts+1))
    launch_child "$@"
    continue
  fi

  age=$(heartbeat_age_seconds)
  if [[ "$age" -gt "$STALE_SEC" ]]; then
    echo "[$(date +%H:%M:%S)] [$TAG] HEARTBEAT STALE (${age}s > ${STALE_SEC}s) — killing child $child_pid" | tee -a "$MASTER_LOG"
    cp "$HEARTBEAT" "$LOGDIR/heartbeat-stale-$TAG-$RUN_ID-$restarts.json" 2>/dev/null
    kill -TERM "$child_pid" 2>/dev/null
    sleep 5
    kill -9 "$child_pid" 2>/dev/null
    # Kill only THIS shard's Chromium + node. Matching by the shard arg in the
    # command line keeps us from killing sibling shards.
    if [[ "$SHARD_COUNT" -gt 1 ]]; then
      pkill -9 -f "scrapeMenusV101.*shardIndex=$SHARD_INDEX.*shardCount=$SHARD_COUNT" 2>/dev/null || true
    else
      pkill -9 -f 'scrapeMenusV101' 2>/dev/null || true
    fi
    # headless_shell is harder to tie to a shard; leave siblings alone by only
    # killing those whose parent is our (dead) child.
    sleep 2
    restarts=$((restarts+1))
    launch_child "$@"
    continue
  fi

  if [[ $((RANDOM % 6)) -eq 0 ]]; then
    idx=$(python3 -c "import json; h=json.load(open('$HEARTBEAT')); print(f\"{h['idx']}/{h['total']} ok={h['ok']} rej={h['rejected']} nm={h['no_menus']} err={h['errored']}\")" 2>/dev/null)
    echo "[$(date +%H:%M:%S)] [$TAG] progress: $idx (heartbeat ${age}s old)" | tee -a "$MASTER_LOG"
  fi
done

if [[ $restarts -ge $MAX_RESTARTS ]]; then
  echo "[$(date +%H:%M:%S)] [$TAG] GAVE UP after $MAX_RESTARTS restarts" | tee -a "$MASTER_LOG"
  exit 2
fi

echo "[$(date +%H:%M:%S)] [$TAG] watchdog exit clean (restarts=$restarts)" | tee -a "$MASTER_LOG"
exit 0
