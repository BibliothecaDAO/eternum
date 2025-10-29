import type { Chain } from "@contracts";
import { buildWorldProfile } from "./profile-builder";
import { getActiveWorld, getActiveWorldName, saveWorldProfile, setActiveWorldName } from "./store";
import { openWorldSelectorModal } from "@/ui/features/world-selector";

export const ensureActiveWorldProfileWithUI = async (chain: Chain) => {
  const activeName = getActiveWorldName();
  if (activeName) {
    const ok = window.confirm(`Use previously selected world: ${activeName}?`);
    if (ok) {
      const existing = getActiveWorld();
      if (existing) return existing;
      const rebuilt = await buildWorldProfile(chain, activeName);
      saveWorldProfile(rebuilt);
      return rebuilt;
    }
  }

  const picked = await openWorldSelectorModal();
  const profile = await buildWorldProfile(chain, picked);
  setActiveWorldName(picked);
  saveWorldProfile(profile);
  return profile;
};
