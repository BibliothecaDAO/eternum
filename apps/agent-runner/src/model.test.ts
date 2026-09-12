import { getModels } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { resolveModel } from "./model";
import { MODEL_PROFILE_NAMES, MODEL_PROFILES } from "./model-profiles";

describe("model profiles", () => {
  it("lists three registered OpenRouter ids per profile", () => {
    const registered = new Set(getModels("openrouter").map((model) => model.id));

    for (const profile of MODEL_PROFILE_NAMES) {
      expect(MODEL_PROFILES[profile], profile).toHaveLength(3);
      for (const id of MODEL_PROFILES[profile]) expect(registered.has(id), `${profile}: ${id}`).toBe(true);
    }
  });

  it("resolves each profile to its first id, with a priced model", () => {
    for (const profile of MODEL_PROFILE_NAMES) {
      const model = resolveModel(profile);
      expect(model.id).toBe(MODEL_PROFILES[profile][0]);
      expect(model.provider).toBe("openrouter");
      expect(model.cost.input).toBeGreaterThan(0);
    }
  });
});
