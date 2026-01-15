import type { Chain } from "@contracts";
import { getActiveWorld, getActiveWorldName, listWorldNames, saveWorldProfile, setActiveWorldName } from "./store";
import { buildWorldProfile } from "./profile-builder";

const promptWorldName = (suggestions: string[]): string | null => {
  const hint = suggestions.length > 0 ? `\nSaved: ${suggestions.join(", ")}` : "";
  return window.prompt(`Enter world name (e.g., credenceox-82389)${hint}`);
};

/**
 * Ensure there is an active world profile. If not, prompt the user to select or enter a name.
 * Confirms using the existing active world if present.
 */
export const ensureActiveWorldProfile = async (chain: Chain) => {
  // If an active world exists and looks valid, confirm usage
  const activeName = getActiveWorldName();
  const savedNames = listWorldNames();

  if (activeName) {
    const ok = window.confirm(`Use previously selected world: ${activeName}?`);
    if (ok) {
      const profile = getActiveWorld();
      if (profile) return profile;
      // Rebuild if profile missing
      const rebuilt = await buildWorldProfile(chain, activeName);
      saveWorldProfile(rebuilt);
      return rebuilt;
    }
  }

  // Let user choose or enter a name
  let chosenName: string | null = null;
  if (savedNames.length > 1) {
    const selected = window.prompt(`Choose a world name from saved or enter new:\n${savedNames.join("\n")}`);
    chosenName = selected && selected.trim().length > 0 ? selected.trim() : null;
  }

  if (!chosenName) {
    chosenName = promptWorldName(savedNames);
  }

  if (!chosenName) throw new Error("World selection cancelled");

  const profile = await buildWorldProfile(chain, chosenName);
  setActiveWorldName(chosenName);
  saveWorldProfile(profile);
  return profile;
};
