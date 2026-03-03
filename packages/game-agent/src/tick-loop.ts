import type { WorldState } from "./types.js";

export interface TickLoop {
  start(): void;
  stop(): void;
  setIntervalMs(intervalMs: number): void;
  readonly intervalMs: number;
  readonly isRunning: boolean;
  readonly tickCount: number;
}

/**
 * Fixed-cadence tick loop. Fires onTick every intervalMs regardless of
 * whether the previous tick has finished. The consumer decides what to
 * do when a tick fires while work is still in progress (e.g. steer the
 * agent with fresh state instead of queuing).
 */
export function createTickLoop(options: {
  intervalMs: number;
  onTick: () => void | Promise<void>;
  onError?: (error: Error) => void;
}): TickLoop {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let count = 0;
  let currentIntervalMs = validateInterval(options.intervalMs);

  function validateInterval(intervalMs: number): number {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error(`intervalMs must be > 0, got ${intervalMs}`);
    }
    return Math.floor(intervalMs);
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function tick() {
    count++;
    try {
      const result = options.onTick();
      // If onTick returns a promise, catch errors from it
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((err) => {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        });
      }
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      // Fire immediately, then on fixed interval
      tick();
      timer = setInterval(tick, currentIntervalMs);
    },
    stop() {
      clearTimer();
      running = false;
    },
    setIntervalMs(intervalMs: number) {
      currentIntervalMs = validateInterval(intervalMs);
      if (running) {
        // Restart interval with new cadence
        clearTimer();
        timer = setInterval(tick, currentIntervalMs);
      }
    },
    get intervalMs() {
      return currentIntervalMs;
    },
    get isRunning() {
      return running;
    },
    get tickCount() {
      return count;
    },
  };
}

export function formatTickPrompt(state: WorldState): string {
  const resourceStr = state.resources
    ? Array.from(state.resources.entries())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "None tracked";

  return `## Tick ${state.tick} - Think Cycle

Current world state snapshot:
- Tick: ${state.tick}
- Entities: ${state.entities.length}
- Resources:
${resourceStr}

Review your soul, task lists, and priorities. Then:

1. Use \`list_actions\` if you need to look up available actions and their parameters
2. Load any relevant skills by reading their SKILL.md files
3. Decide on your action(s) for this tick
4. Use \`execute_action\` to submit your chosen action(s)
5. Use \`write\` to update your task files, priorities, or learnings as needed
7. Use \`set_agent_config\` when you need to tune yourself (model, loop timing, world connectivity)
8. Maintain \`HEARTBEAT.md\` for cron-style recurring jobs you want to run outside the main tick
9. Explain your reasoning briefly`;
}
