import type { AgentRuntimeConfig, SteeringJobConfig, SteeringJobType } from "@bibliothecadao/types";

import type { SteeringOverlay, SteeringOverlayResolver } from "./types";

const STEERING_LABELS: Record<SteeringJobType, string> = {
  scout: "Scout",
  defend: "Defend",
  gather: "Gather",
  expand: "Expand",
  support: "Support",
  custom: "Custom",
};

type SteeringTemplate = {
  summary: string;
  promptSupplement: string;
  taskOverrides: Record<string, string>;
  runtimeConfigOverrides: Partial<AgentRuntimeConfig>;
  memoryNote: string;
};

const STEERING_TEMPLATES: Record<SteeringJobType, SteeringTemplate> = {
  scout: {
    summary: "Favor reconnaissance, unexplored spaces, and nearby threat discovery.",
    promptSupplement:
      "Favor scouting unexplored nearby tiles before economic actions. Prioritize reconnaissance, fog clearing, and identifying tactical threats or opportunities.",
    taskOverrides: {
      exploration: "high",
      combat: "medium",
      economy: "low",
    },
    runtimeConfigOverrides: {
      maxToolCalls: 4,
    },
    memoryNote: "Current steering: scout nearby territory and surface actionable map intelligence.",
  },
  defend: {
    summary: "Favor protecting nearby holdings and reacting quickly to threats.",
    promptSupplement:
      "Bias toward defending owned structures, intercepting nearby threats, and stabilizing the local position before expanding outward.",
    taskOverrides: {
      combat: "high",
      defense: "high",
      economy: "low",
    },
    runtimeConfigOverrides: {
      maxMutatingActionGroups: 2,
    },
    memoryNote: "Current steering: defend nearby holdings and respond to immediate threats first.",
  },
  gather: {
    summary: "Favor resource flow, logistics, and economic opportunity.",
    promptSupplement:
      "Bias toward resource collection, logistics, and safe economic progression. Prefer moves that improve income, carrying efficiency, or stockpile resilience.",
    taskOverrides: {
      economy: "high",
      logistics: "high",
      exploration: "medium",
    },
    runtimeConfigOverrides: {
      maxToolCalls: 6,
    },
    memoryNote: "Current steering: gather resources and improve logistics before riskier actions.",
  },
  expand: {
    summary: "Favor growth, realm progression, and strategic expansion.",
    promptSupplement:
      "Bias toward growth, progression, and expansion opportunities that strengthen long-term position without taking reckless fights.",
    taskOverrides: {
      growth: "high",
      economy: "medium",
      combat: "medium",
    },
    runtimeConfigOverrides: {
      maxToolCalls: 6,
    },
    memoryNote: "Current steering: expand the realm and improve long-term position.",
  },
  support: {
    summary: "Favor reinforcing the current strategic plan and assisting nearby priorities.",
    promptSupplement:
      "Bias toward supporting the broader strategic state. Reinforce current priorities, unblock stalled plans, and assist nearby allied objectives when possible.",
    taskOverrides: {
      support: "high",
      economy: "medium",
      combat: "medium",
    },
    runtimeConfigOverrides: {
      maxToolCalls: 5,
    },
    memoryNote: "Current steering: support the broader plan and reinforce the most relevant nearby objective.",
  },
  custom: {
    summary: "Favor the player-specified objective while preserving autonomous judgment.",
    promptSupplement:
      "Bias toward the current custom objective while preserving autonomous judgment, safety, and tactical sanity.",
    taskOverrides: {
      custom: "high",
    },
    runtimeConfigOverrides: {},
    memoryNote: "Current steering: follow the current custom objective without becoming overly rigid.",
  },
};

export async function resolveSteeringOverlay(
  agentId: string,
  worldId: string | undefined,
  resolver: SteeringOverlayResolver | undefined,
): Promise<SteeringOverlay | null> {
  if (!resolver) {
    return null;
  }

  return resolver.load({ agentId, worldId });
}

export function createSteeringOverlay(input: {
  jobType: SteeringJobType;
  config?: SteeringJobConfig;
  updatedAt?: string;
}): SteeringOverlay {
  const template = STEERING_TEMPLATES[input.jobType];
  const customObjective = sanitizeCustomObjective(input.config?.objective);
  const promptSupplement =
    input.jobType === "custom" && customObjective
      ? `${template.promptSupplement}\n\nActive objective: ${customObjective}`
      : template.promptSupplement;

  const summary =
    input.jobType === "custom" && customObjective ? `Favor the custom objective: ${customObjective}` : template.summary;

  const memoryNote =
    input.jobType === "custom" && customObjective ? `Current steering: ${customObjective}` : template.memoryNote;

  return {
    jobType: input.jobType,
    summary,
    promptSupplement,
    taskOverrides: template.taskOverrides,
    runtimeConfigOverrides: template.runtimeConfigOverrides,
    memoryNote,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildSteeringPromptSupplement(overlay: SteeringOverlay | null | undefined): string {
  if (!overlay) {
    return "";
  }

  return `## Steering\n${overlay.promptSupplement}`;
}

export function buildSteeringMemoryNote(overlay: SteeringOverlay | null | undefined): string | null {
  return overlay?.memoryNote?.trim() ? overlay.memoryNote : null;
}

export function applySteeringOverlay<TContext extends { runtimeConfig?: Partial<AgentRuntimeConfig>; prompt?: string }>(
  runtimeContext: TContext,
  overlay: SteeringOverlay | null | undefined,
): TContext {
  if (!overlay) {
    return runtimeContext;
  }

  const promptSupplement = buildSteeringPromptSupplement(overlay);
  return {
    ...runtimeContext,
    runtimeConfig: {
      ...(runtimeContext.runtimeConfig ?? {}),
      ...overlay.runtimeConfigOverrides,
    },
    ...(runtimeContext.prompt
      ? {
          prompt: `${promptSupplement}\n\n${runtimeContext.prompt}`.trim(),
        }
      : {}),
  };
}

export function getSteeringLabel(jobType: SteeringJobType): string {
  return STEERING_LABELS[jobType];
}

function sanitizeCustomObjective(objective: string | undefined): string | null {
  const trimmed = objective?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 240);
}
