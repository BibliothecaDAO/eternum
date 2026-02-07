import type { WorldState } from "./types.js";

export interface TickLoop {
	start(): void;
	stop(): void;
	setIntervalMs(intervalMs: number): void;
	readonly intervalMs: number;
	readonly isRunning: boolean;
	readonly tickCount: number;
}

export function createTickLoop(options: {
	intervalMs: number;
	onTick: () => Promise<void>;
	onError?: (error: Error) => void;
}): TickLoop {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let ticking = false;
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
			clearTimeout(timer);
			timer = null;
		}
	}

	function scheduleNextTick() {
		if (!running) {
			return;
		}
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void tick();
		}, currentIntervalMs);
	}

	async function tick() {
		if (ticking) return;
		ticking = true;
		try {
			await options.onTick();
			count++;
		} catch (err) {
			options.onError?.(err instanceof Error ? err : new Error(String(err)));
		} finally {
			ticking = false;
			scheduleNextTick();
		}
	}

	return {
		start() {
			if (running) return;
			running = true;
			void tick();
		},
		stop() {
			clearTimer();
			running = false;
		},
		setIntervalMs(intervalMs: number) {
			currentIntervalMs = validateInterval(intervalMs);
			if (running) {
				scheduleNextTick();
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

1. Use \`observe_game\` if you need more detail on specific areas
2. Load any relevant skills by reading their SKILL.md files
3. Decide on your action(s) for this tick
4. Use \`execute_action\` to submit your chosen action(s)
5. Use \`write\` to update your task files, priorities, reflection, or soul as needed
6. Use \`set_agent_config\` when you need to tune yourself (model, loop timing, world connectivity)
7. Maintain \`HEARTBEAT.md\` for cron-style recurring jobs you want to run outside the main tick
8. Explain your reasoning briefly`;
}
