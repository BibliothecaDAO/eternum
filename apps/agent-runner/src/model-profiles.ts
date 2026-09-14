/**
 * The model routing table, as data. Each profile lists OpenRouter ids in preference order: the first is what the
 * runner uses today; the rest are the alternates the M5 proxy will route between. Every id must be registered in
 * pi-ai's OpenRouter registry, and the runner refuses to boot when one is not (see resolveModel).
 */
export const MODEL_PROFILE_NAMES = ["cheap", "balanced", "strong"] as const;

export type ModelProfileName = (typeof MODEL_PROFILE_NAMES)[number];

export const DEFAULT_MODEL_PROFILE: ModelProfileName = "balanced";

export const MODEL_PROFILES: Record<ModelProfileName, readonly string[]> = {
  cheap: ["google/gemini-3.1-flash-lite-preview", "openai/gpt-5.4-nano", "deepseek/deepseek-v4-flash"],
  balanced: ["openai/gpt-5.4-mini", "google/gemini-3-flash-preview", "anthropic/claude-haiku-4.5"],
  strong: ["anthropic/claude-sonnet-4.6", "openai/gpt-5.4", "google/gemini-3.1-pro-preview"],
};

export const isModelProfileName = (value: string): value is ModelProfileName =>
  (MODEL_PROFILE_NAMES as readonly string[]).includes(value);
