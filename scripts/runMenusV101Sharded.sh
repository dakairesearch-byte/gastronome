#!/bin/bash
# Parallel shard launcher for v101.
#
# Starts K copies of runMenusV101Watchdog.sh in the background, one per shard.
# Each watchdog has its own heartbeat / progress file and its own Chromium.
# On exit (Ctrl-C or after the last watchdog finishes) all shards are killed.
#
# Usage:
#   bash scripts/runMenusV101Sharded.sh --shardCount=5 \
#        --idsFile=tmp/no-menu-priority-ids.txt
#   bash scripts/runMenusV101Sharded.sh --shardCount=3 --ids=a,b,c,d,e,f
#
# Every arg other than --shardCount is passed through to every shard.
# --shardCount is consumed here; we synthesise --shardIndex per shard.
#
# Env overrides (applied to every child watchdog):
#   POLL_SEC=10
#   STALE_SEC=120
#   MAX_RESTARTS=20

set -u
cd "$(dirname "$0")/.."

SHARD_COUNT=0
PASSTHROUGH=()
for arg in "$@"; do
  case "$arg" in
    --shardCount=*) SHARD_COUNT="${arg#--shardCount=}" ;;
    --shardIndex=*) ;;  # ignore any manual shardIndex; we set it per-shard
    *) PASSTHROUGH+=("$arg") ;;
  esac
done

if [[ "$SHARD_COUNT" -lt 1 ]]; then
  echo "ERROR: --shardCount=N required (N >= 1)" >&2
  exit 1
fi

LOGDIR=tmp/v101-watchdog-logs
mkdir -p "$LOGDIR"
RUN_ID=$(date +%Y%m%d-%H%M%S)
MASTER_LOG="$LOGDIR/sharded-runner-$RUN_ID.log"
echo "[$(date +%H:%M:%S)] sharded runner start run=$RUN_ID shards=$SHARD_COUNT passthrough='${PASSTHROUGH[*]:-}'" | tee -a "$MASTER_LOG"

pids=()
cleanup() {
  echo "[$(date +%H:%M:%S)] sharded cleanup: killing ${#pids[@]} watchdog(s)" | tee -a "$MASTER_LOG"
  for p in "${pids[@]}"; do
    kill -TERM "$p" 2>/dev/null || true
  done
  sleep 3
  for p in "${pids[@]}"; do
    kill -9 "$p" 2>/dev/null || true
  done
  # Best-effort cleanup of any tsx / Chromium still around
  pkill -9 -f 'scrapeMenusV101' 2>/dev/null || true
  pkill -9 -f 'headless_shell' 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Launch K watchdogs
for (( i=0; i<SHARD_COUNT; i++ )); do
  sub_log="$LOGDIR/sharded-runner-$RUN_ID-shard-$i.log"
  echo "[$(date +%H:%M:%S)] launching shard $i/$SHARD_COUNT -> $sub_log" | tee -a "$MASTER_LOG"
  # shellcheck disable=SC2068
  nohup bash scripts/runMenusV101Watchdog.sh \
    --shardIndex=$i \
    --shardCount=$SHARD_COUNT \
    ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"} > "$sub_log" 2>&1 &
  pids+=($!)
  # Stagger launches by 3s so browsers don't all fire up at the same instant.
  # Helps prevent a spike of simultaneous fetches to the same geographic pool.
  sleep 3
done

echo "[$(date +%H:%M:%S)] all ${#pids[@]} watchdogs launched: ${pids[*]}" | tee -a "$MASTER_LOG"

# Periodic combined-progress summary
while true; do
  # Exit if all children have died
  alive=0
  for p in "${pids[@]}"; do
    if kill -0 "$p" 2>/dev/null; then alive=$((alive+1)); fi
  done
  if [[ "$alive" -eq 0 ]]; then
    echo "[$(date +%H:%M:%S)] all watchdogs exited — done" | tee -a "$MASTER_LOG"
    break
  fi

  sleep 30

  # Aggregate heartbeats across shards
  python3 - <<PY "$SHARD_COUNT" | tee -a "$MASTER_LOG"
import json, os, sys, datetime
K = int(sys.argv[1])
total_ok = total_rej = total_nm = total_err = total_skip = 0
total_total = total_idx = 0
now = datetime.datetime.now(datetime.timezone.utc)
lines = []
for i in range(K):
    path = f"tmp/v101-heartbeat-shard-{i}-of-{K}.json" if K > 1 else "tmp/v101-heartbeat.json"
    if not os.path.exists(path):
        lines.append(f"  shard {i}: (no heartbeat yet)")
        continue
    try:
        h = json.load(open(path))
        age = int((now - datetime.datetime.fromisoformat(h['last_beat'].replace('Z','+00:00'))).total_seconds())
        idx = h.get('idx', 0); tot = h.get('total', 0)
        ok = h.get('ok', 0); rej = h.get('rejected', 0); nm = h.get('no_menus', 0)
        err = h.get('errored', 0); sk = h.get('skipped', 0)
        total_ok += ok; total_rej += rej; total_nm += nm; total_err += err; total_skip += sk
        total_total += tot; total_idx += idx
        lines.append(f"  shard {i}: {idx}/{tot} ok={ok} rej={rej} nm={nm} err={err} phase={h.get('phase','?')} beat={age}s ago")
    except Exception as e:
        lines.append(f"  shard {i}: parse error {e}")
print(f"[{now.strftime('%H:%M:%S')}] combined: {total_idx}/{total_total} ok={total_ok} rej={total_rej} nm={total_nm} err={total_err} skip={total_skip}")
for ln in lines:
    print(ln)
PY
done

echo "[$(date +%H:%M:%S)] sharded runner exit" | tee -a "$MASTER_LOG"
exit 0
