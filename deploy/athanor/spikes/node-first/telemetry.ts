import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function cpu(pid: number) {
  const hz = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }));
  const host = () =>
    Object.fromEntries(
      readFileSync("/proc/stat", "utf8")
        .split("\n")
        .filter((l) => /^cpu\d+ /.test(l))
        .map((l) => {
          const [name, ...values] = l.trim().split(/\s+/);
          const ticks = values.map(Number);
          return [name, { total: ticks.slice(0, 8).reduce((a, b) => a + b, 0), idle: ticks[3]! + ticks[4]! }];
        }),
    );
  const hostBefore = host();
  const cpuset = /^Cpus_allowed_list:\s*(.*)$/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1];
  const samples: { at: number; threads: { tid: string; ticks: number; core: number }[] }[] = [];
  const sample = () => {
    const threads = readdirSync(`/proc/${pid}/task`).flatMap((tid) => {
      try {
        const raw = readFileSync(`/proc/${pid}/task/${tid}/stat`, "utf8");
        const f = raw
          .slice(raw.lastIndexOf(")") + 2)
          .trim()
          .split(/\s+/);
        return [{ tid, ticks: Number(f[11]) + Number(f[12]), core: Number(f[36]) }];
      } catch {
        return [];
      }
    });
    samples.push({ at: performance.now(), threads });
  };
  sample();
  const timer = setInterval(sample, 100);
  return {
    finish() {
      clearInterval(timer);
      sample();
      const byCore: Record<string, number> = {};
      for (let i = 1; i < samples.length; i++) {
        const previous = new Map(samples[i - 1]!.threads.map((t) => [t.tid, t]));
        for (const t of samples[i]!.threads) {
          const old = previous.get(t.tid);
          if (old && t.ticks >= old.ticks) byCore[t.core] = (byCore[t.core] ?? 0) + ((t.ticks - old.ticks) / hz) * 1000;
        }
      }
      const elapsedMs = samples.at(-1)!.at - samples[0]!.at;
      const hostAfter = host();
      const hostPerCore = Object.entries(hostAfter).map(([core, t]) => {
        const old = hostBefore[core]!;
        const total = t.total - old.total;
        return { core, busyPercent: total ? ((total - (t.idle - old.idle)) / total) * 100 : null };
      });
      return {
        elapsedMs,
        cpuset,
        hostPerCore,
        perCore: Object.entries(byCore).map(([core, cpuMs]) => ({
          core: Number(core),
          cpuMs,
          busyPercent: (cpuMs / elapsedMs) * 100,
        })),
        samples,
        attribution:
          "Node thread CPU ticks assigned to last observed processor; migration is approximate, not a kernel per-core profile",
      };
    },
  };
}
export function metricCounters(file: string | undefined) {
  const wanted = [
    "blockifier_execution_attempts_total",
    "blockifier_committed_transactions_total",
    "blockifier_aborts_total",
    "blockifier_commit_phase_aborts_total",
  ];
  const values: Record<string, number> = {};
  if (file && existsSync(file))
    for (const line of readFileSync(file, "utf8").trim().split("\n")) {
      try {
        const row = JSON.parse(line);
        for (const resource of row.resourceMetrics ?? [])
          for (const scope of resource.scopeMetrics ?? [])
            for (const metric of scope.metrics ?? []) {
              if (!wanted.includes(metric.name)) continue;
              for (const point of metric.sum?.dataPoints ?? [])
                values[metric.name] = Number(point.asInt ?? point.asDouble);
            }
      } catch {
        /* Collector's last line may still be in progress. */
      }
    }
  return { values, missing: wanted.filter((n) => values[n] === undefined) };
}
export function executorLogs(file: string | undefined, offset: number) {
  if (!file || !existsSync(file)) return { unavailable: true, batches: [], blocksClosed: null };
  const lines = readFileSync(file, "utf8").slice(offset).split("\n");
  const batches = lines
    .filter((l) => l.includes("received_executor_batch_executed"))
    .map((line) => ({
      size: Number(/txs_executed_in_batch[=: ]+(\d+)/.exec(line)?.[1] ?? NaN),
      executionMs: Number(/batch_exec_duration_ms[=: ]+([\d.]+)/.exec(line)?.[1] ?? NaN),
      line,
    }));
  return {
    unavailable: batches.length === 0,
    batches,
    blocksClosed: lines.filter((l) => l.includes("close_block_complete")).length,
  };
}
export function textLength(file: string | undefined) {
  return file && existsSync(file) ? readFileSync(file, "utf8").length : 0;
}
