#!/usr/bin/env bash
# Snapshots the machine and chain state that make a harness run reproducible and comparable to another.
# One JSON object on stdout. Run it at the start and end of a run and attach both to the manifest, so a
# number can always be read against the box, the governor, the swap pressure and the chain config it came from.
#
#   deploy/madara-lab/scripts/host-state.sh
#   deploy/madara-lab/scripts/host-state.sh | jq .
#
# No sudo, no mutation. Missing inputs (a governor file on a VM, a stopped container) come back null, never fail.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$LAB_DIR/chain-config.yaml"
CONTAINER="${MADARA_CONTAINER:-madara-lab}"

read -r load1 load5 load15 _ < /proc/loadavg

cpu_model=$(sed -n 's/^model name[[:space:]]*: //p' /proc/cpuinfo | head -1)
cpu_threads=$(nproc)
governor=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "")
cur_mhz=$(awk '/cpu MHz/{s+=$4;n++} END{if(n)printf "%.0f", s/n}' /proc/cpuinfo)

mem_total_kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
mem_avail_kb=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
swap_total_kb=$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)
swap_free_kb=$(awk '/^SwapFree:/{print $2}' /proc/meminfo)

# Madara container: cpu%, mem, and the running image digest / native-execution flag it was started with.
madara_cpu=null; madara_mem_mib=null; image=null; native=null; native_classes=null
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  read -r madara_cpu madara_mem_bytes < <(docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}' "$CONTAINER" \
    | awk '{gsub(/%/,"",$1); print $1, $2}')
  madara_mem_mib=$(docker stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" | awk '{print $1}' | sed 's/[A-Za-z]*//g')
  image=$(docker inspect "$CONTAINER" --format '{{index .Config.Image}}')
  native=$(docker inspect "$CONTAINER" --format '{{range .Args}}{{println .}}{{end}}' \
    | sed -n 's/^--enable-native-execution=//p' | head -1)
  native_classes=$(docker exec "$CONTAINER" sh -c 'ls /data/native_classes 2>/dev/null | wc -l' 2>/dev/null || echo "")
fi

# Chain-config knobs that change every measurement if touched.
cfg() { sed -n "s/^[[:space:]]*$1:[[:space:]]*//p" "$CONFIG" | head -1 | tr -d '"'; }

jq -n \
  --arg load1 "$load1" --arg load5 "$load5" --arg load15 "$load15" \
  --arg cpu_model "$cpu_model" --arg cpu_threads "$cpu_threads" --arg governor "$governor" --arg cur_mhz "${cur_mhz:-}" \
  --arg mem_total_kb "$mem_total_kb" --arg mem_avail_kb "$mem_avail_kb" \
  --arg swap_total_kb "$swap_total_kb" --arg swap_free_kb "$swap_free_kb" \
  --arg madara_cpu "${madara_cpu:-}" --arg madara_mem_mib "${madara_mem_mib:-}" \
  --arg image "${image:-}" --arg native "${native:-}" --arg native_classes "${native_classes:-}" \
  --arg block_time "$(cfg block_time)" --arg pending "$(cfg pending_block_update_time)" \
  --arg batch "$(cfg execution_batch_size)" --arg n_txs "$(cfg n_txs)" --arg sierra_gas "$(cfg sierra_gas)" \
  '{
    host: {
      cpu: $cpu_model, threads: ($cpu_threads|tonumber), governor: (if $governor=="" then null else $governor end),
      cpuMhz: (if $cur_mhz=="" then null else ($cur_mhz|tonumber) end),
      load: { "1m": ($load1|tonumber), "5m": ($load5|tonumber), "15m": ($load15|tonumber) },
      memTotalMib: (($mem_total_kb|tonumber)/1024|floor),
      memAvailMib: (($mem_avail_kb|tonumber)/1024|floor),
      swapTotalMib: (($swap_total_kb|tonumber)/1024|floor),
      swapUsedMib: ((($swap_total_kb|tonumber)-($swap_free_kb|tonumber))/1024|floor)
    },
    madara: {
      image: (if $image=="" then null else $image end),
      nativeExecution: (if $native=="" then null else ($native=="true") end),
      nativeClassesCached: (if $native_classes=="" then null else ($native_classes|tonumber) end),
      cpuPercent: (if $madara_cpu=="" then null else ($madara_cpu|tonumber) end),
      memMib: (if $madara_mem_mib=="" then null else ($madara_mem_mib|tonumber) end)
    },
    chainConfig: {
      blockTime: $block_time, pendingBlockUpdateTime: $pending,
      executionBatchSize: (if $batch=="" then null else ($batch|tonumber) end),
      nTxsPerBlock: (if $n_txs=="" then null else ($n_txs|tonumber) end),
      sierraGasPerBlock: (if $sierra_gas=="" then null else ($sierra_gas|tonumber) end)
    }
  }'
