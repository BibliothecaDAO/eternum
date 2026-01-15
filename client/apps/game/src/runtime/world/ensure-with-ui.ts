import type { Chain } from "@contracts";
import { buildWorldProfile } from "./profile-builder";
import { applyWorldSelection } from "./selection";
import { getActiveWorld, getActiveWorldName, saveWorldProfile } from "./store";
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
  const result = await applyWorldSelection(picked, chain);
  saveWorldProfile(result.profile);
  if (result.chainChanged) {
    window.location.reload();
    return new Promise(() => {});
  }
  return result.profile;
};
