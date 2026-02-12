import { existsSync, readFileSync } from "fs";
import YAML from "yaml";

export type HeartbeatJobMode = "observe" | "act";

export interface HeartbeatJob {
  id: string;
  enabled: boolean;
  schedule: string;
  prompt: string;
  mode: HeartbeatJobMode;
  timeoutSec?: number;
}

export interface HeartbeatConfig {
  version: number;
  jobs: HeartbeatJob[];
}

export interface HeartbeatLoop {
  start(): void;
  stop(): void;
  setPollIntervalMs(intervalMs: number): void;
  readonly pollIntervalMs: number;
  readonly isRunning: boolean;
  readonly cycleCount: number;
}

function extractYamlPayload(markdown: string): string {
  const yamlBlock = markdown.match(/```ya?ml\s*\n([\s\S]*?)\n```/i);
  if (yamlBlock?.[1]) {
    return yamlBlock[1];
  }
  return markdown;
}

function normalizeJob(raw: unknown): HeartbeatJob | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const input = raw as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const schedule = typeof input.schedule === "string" ? input.schedule.trim() : "";
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  if (!id || !schedule || !prompt.trim()) {
    return null;
  }
  return {
    id,
    enabled: input.enabled === undefined ? true : Boolean(input.enabled),
    schedule,
    prompt,
    mode: input.mode === "act" ? "act" : "observe",
    timeoutSec: typeof input.timeoutSec === "number" && input.timeoutSec > 0 ? Math.floor(input.timeoutSec) : undefined,
  };
}

export function parseHeartbeatConfig(markdown: string): HeartbeatConfig {
  const payload = extractYamlPayload(markdown);
  let parsed: { version?: unknown; jobs?: unknown } | null = null;
  try {
    parsed = YAML.parse(payload) as { version?: unknown; jobs?: unknown } | null;
  } catch {
    // Invalid YAML (e.g. agent overwrote with markdown) — return empty config
    return { version: 1, jobs: [] };
  }
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, jobs: [] };
  }
  const jobsRaw = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const jobs = jobsRaw.map(normalizeJob).filter((job): job is HeartbeatJob => Boolean(job));
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    jobs,
  };
}

function validateCronFieldValue(value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Cron value ${value} out of range ${min}-${max}`);
  }
}

function matchesCronPart(part: string, value: number, min: number, max: number): boolean {
  const normalized = part.trim();
  if (normalized === "*") {
    return true;
  }

  if (normalized.includes("/")) {
    const [base, stepRaw] = normalized.split("/");
    const step = Number(stepRaw);
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`Invalid cron step '${normalized}'`);
    }
    if (base === "*") {
      return (value - min) % step === 0;
    }
    if (base.includes("-")) {
      const [startRaw, endRaw] = base.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      validateCronFieldValue(start, min, max);
      validateCronFieldValue(end, min, max);
      if (value < start || value > end) {
        return false;
      }
      return (value - start) % step === 0;
    }
    throw new Error(`Invalid cron base '${normalized}'`);
  }

  if (normalized.includes("-")) {
    const [startRaw, endRaw] = normalized.split("-");
    const start = Number(startRaw);
    const end = Number(endRaw);
    validateCronFieldValue(start, min, max);
    validateCronFieldValue(end, min, max);
    return value >= start && value <= end;
  }

  const exact = Number(normalized);
  validateCronFieldValue(exact, min, max);
  return value === exact;
}

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  return field
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => matchesCronPart(part, value, min, max));
}

export function cronMatchesDate(schedule: string, date: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron schedule '${schedule}'`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return (
    matchesCronField(minute, date.getMinutes(), 0, 59) &&
    matchesCronField(hour, date.getHours(), 0, 23) &&
    matchesCronField(dayOfMonth, date.getDate(), 1, 31) &&
    matchesCronField(month, date.getMonth() + 1, 1, 12) &&
    matchesCronField(dayOfWeek, date.getDay(), 0, 6)
  );
}

export interface HeartbeatRunContext {
  now: Date;
  scheduledFor: Date;
  minuteKey: string;
}

function minuteKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
}

function validatePollInterval(intervalMs: number): number {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`pollIntervalMs must be > 0, got ${intervalMs}`);
  }
  return Math.floor(intervalMs);
}

export function createHeartbeatLoop(options: {
  getHeartbeatPath: () => string;
  onRun: (job: HeartbeatJob, context: HeartbeatRunContext) => Promise<void>;
  pollIntervalMs?: number;
  onError?: (error: Error) => void;
  now?: () => Date;
}): HeartbeatLoop {
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cycle = 0;
  let busy = false;
  let currentPollMs = validatePollInterval(options.pollIntervalMs ?? 15_000);
  const lastRunByJobId = new Map<string, string>();
  const nowFn = options.now ?? (() => new Date());

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleNext() {
    if (!running) {
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void poll();
    }, currentPollMs);
  }

  async function poll() {
    if (!running) {
      return;
    }
    if (busy) {
      scheduleNext();
      return;
    }
    busy = true;
    try {
      const heartbeatPath = options.getHeartbeatPath();
      if (existsSync(heartbeatPath)) {
        const markdown = readFileSync(heartbeatPath, "utf8");
        const config = parseHeartbeatConfig(markdown);
        const now = nowFn();
        const currentMinute = minuteKey(now);
        for (const job of config.jobs) {
          if (!job.enabled) {
            continue;
          }
          try {
            if (!cronMatchesDate(job.schedule, now)) {
              continue;
            }
          } catch (error) {
            options.onError?.(error instanceof Error ? error : new Error(String(error)));
            continue;
          }
          const lastRunMinute = lastRunByJobId.get(job.id);
          if (lastRunMinute === currentMinute) {
            continue;
          }
          await options.onRun(job, {
            now,
            scheduledFor: now,
            minuteKey: currentMinute,
          });
          lastRunByJobId.set(job.id, currentMinute);
        }
      }
      cycle++;
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      busy = false;
      scheduleNext();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void poll();
    },
    stop() {
      running = false;
      clearTimer();
    },
    setPollIntervalMs(intervalMs: number) {
      currentPollMs = validatePollInterval(intervalMs);
      if (running) {
        scheduleNext();
      }
    },
    get pollIntervalMs() {
      return currentPollMs;
    },
    get isRunning() {
      return running;
    },
    get cycleCount() {
      return cycle;
    },
  };
}
