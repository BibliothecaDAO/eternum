import { getModels, type Model } from "@mariozechner/pi-ai";

import { MODEL_PROFILES, type ModelProfileName } from "./model-profiles";

/**
 * The model a profile plays with, taken from pi-ai's OpenRouter registry at boot. Every id the profile lists must be
 * registered: a drifted table fails here, loudly, rather than substituting a model the cost manifest would misprice.
 */
export function resolveModel(profile: ModelProfileName): Model<any> {
  const registry = new Map(getModels("openrouter").map((model) => [model.id, model]));
  const candidates = MODEL_PROFILES[profile];
  const unregistered = candidates.filter((id) => !registry.has(id));
  if (unregistered.length > 0) {
    throw new Error(
      `Model profile "${profile}" names OpenRouter ids pi-ai does not register: ${unregistered.join(", ")}. Update model-profiles.ts; the runner does not substitute models.`,
    );
  }
  return registry.get(candidates[0]!)!;
}
