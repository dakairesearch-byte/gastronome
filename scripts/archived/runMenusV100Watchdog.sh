#!/bin/bash
# Watchdog runner for scrapeMenusV100.ts.
#
# Motivation: the user reported "we've had issues here where it stops in the
# background". This wrapper guarantees forward progress:
#
#   1. Launches v100 as a child process.
#   2. Polls tmp/v100-heartbeat.json every POLL_SEC.
#   3. If heartbeat is stale (not updated for STALE_SEC), kills the child.
#   4. v100 is resume-safe via tmp/v100-progress.json, so we just relaunch.
#   5. Retries until either all ids are done (heartbeat phase='idle') or
#      MAX_RESTARTS is exhausted.
#
# Usage:
#   bash scripts/runMenusV100Watchdog.sh --idsFile=tmp/no-menu-priority-ids.txt
#   bash scripts/runMenusV100Watchdog.sh --ids=id1,id2,id3
#   bash scripts/runMenusV100Watchdog.sh --idsFile=... --stages=browser --browserRecycle=15
#
# Env overrides:
#   POLL_SEC=10       heartbeat poll interval
#   STALE_SEC=120     declare stall if no heartbeat this long
#   MAX_RESTARTS=20   give up after this many relaunches

set -u
cd "$(dirname "$0")/.."

POLL_SEC=${POLL_SEC:-10}
STALE_SEC=${STALE_SEC:-120}
MAX_RESTARTS=${MAX_RESTARTS:-20}

HEARTBEAT=tmp/v100-heartbeat.json
LOGDIR=tmp/v100-watchdog-logs
mkdir -p "$LOGDIR"
export TMPDIR="${PW_TMPDIR:-$HOME/tmp/pw-artifacts}"
mkdir -p "$TMPDIR"

RUN_ID=$(date +%Y%m%d-%H%M%S)
MASTER_LOG="$LOGDIR/watchdog-$RUN_ID.log"
echo "[$(date +%H:%M:%S)] watchdog start run=$RUN_ID args=$*" | tee -a "$MASTER_LOG"

child_pid=0
restarts=0
cleanup() {
  if [[ $child_pid -gt 0 ]] && kill -0 "$child_pid" 2>/dev/null; then
    echo "[$(date +%H:%M:%S)] cleanup: sending SIGTERM to child $child_pid" | tee -a "$MASTER_LOG"
    kill -TERM "$child_pid" 2>/dev/null
    sleep 3
    kill -9 "$child_pid" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

launch_child() {
  local log="$LOGDIR/v100-$RUN_ID-attempt-$restarts.log"
  echo "[$(date +%H:%M:%S)] launching v100 (attempt $restarts) -> $log" | tee -a "$MASTER_LOG"
  nohup npx tsx scripts/scrapeMenusV100.ts "$@" > "$log" 2>&1 &
  child_pid=$!
  echo "[$(date +%H:%M:%S)] child pid=$child_pid" | tee -a "$MASTER_LOG"
  # Wait for heartbeat to appear (up to 30s) so we have a baseline
  local waited=0
  while [[ ! -f "$HEARTBEAT" && $waited -lt 30 ]]; do
    sleep 2; waited=$((waited+2))
  done
  if [[ ! -f "$HEARTBEAT" ]]; then
    echo "[$(date +%H:%M:%S)] WARN: no heartbeat after 30s" | tee -a "$MASTER_LOG"
  fi
}

is_done() {
  # v100 is done if it finished its todo list. Two success states:
  #   (a) phase in ('idle','finalize') and idx==total (normal completion)
  #   (b) total==0 (every id was already-persisted / filtered out)
  # Either way we should stop the watchdog.
  [[ -f "$HEARTBEAT" ]] || return 1
  python3 - <<'PY' "$HEARTBEAT"
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

# Initial launch
launch_child "$@"

while [[ $restarts -lt $MAX_RESTARTS ]]; do
  sleep "$POLL_SEC"

  if ! kill -0 "$child_pid" 2>/dev/null; then
    # Child exited. Check if done.
    if is_done; then
      echo "[$(date +%H:%M:%S)] child exited and heartbeat says idle — DONE" | tee -a "$MASTER_LOG"
      break
    fi
    echo "[$(date +%H:%M:%S)] child $child_pid died without completing — relaunching" | tee -a "$MASTER_LOG"
    restarts=$((restarts+1))
    launch_child "$@"
    continue
  fi

  age=$(heartbeat_age_seconds)
  if [[ "$age" -gt "$STALE_SEC" ]]; then
    echo "[$(date +%H:%M:%S)] HEARTBEAT STALE (${age}s > ${STALE_SEC}s) — killing child $child_pid" | tee -a "$MASTER_LOG"
    # Snapshot the current heartbeat for debugging
    cp "$HEARTBEAT" "$LOGDIR/heartbeat-stale-$RUN_ID-$restarts.json" 2>/dev/null
    kill -TERM "$child_pid" 2>/dev/null
    sleep 5
    kill -9 "$child_pid" 2>/dev/null
    # Kill any lingering Chromium that v100 left behind
    pkill -9 -f 'headless_shell' 2>/dev/null || true
    pkill -9 -f 'scrapeMenusV100' 2>/dev/null || true
    sleep 2
    restarts=$((restarts+1))
    launch_child "$@"
    continue
  fi

  # Periodic progress report
  if [[ $((RANDOM % 6)) -eq 0 ]]; then
    idx=$(python3 -c "import json; h=json.load(open('$HEARTBEAT')); print(f\"{h['idx']}/{h['total']} ok={h['ok']} rej={h['rejected']} nm={h['no_menus']} err={h['errored']}\")" 2>/dev/null)
    echo "[$(date +%H:%M:%S)] progress: $idx (heartbeat ${age}s old)" | tee -a "$MASTER_LOG"
  fi
done

if [[ $restarts -ge $MAX_RESTARTS ]]; then
  echo "[$(date +%H:%M:%S)] GAVE UP after $MAX_RESTARTS restarts" | tee -a "$MASTER_LOG"
  exit 2
fi

echo "[$(date +%H:%M:%S)] watchdog exit clean (restarts=$restarts)" | tee -a "$MASTER_LOG"
exit 0
