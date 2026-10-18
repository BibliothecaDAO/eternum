import { useShortcutStore } from "@/hooks/store/use-shortcut-store";
import {
  type StructureAction,
  useStructureActions,
} from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { useEffect, useRef } from "react";
import { type IdleArmies, selectNextIdleArmy } from "./idle-armies";
import { useNextUpShows } from "./next-up-shows";

/** The four workspaces' keys, each the first letter of its order. */
export const ORDER_KEYS: Partial<Record<StructureAction["id"], string>> = {
  build: "B",
  production: "P",
  military: "M",
  transfer: "T",
};

const PREFIX = "hud.";

/**
 * The desktop HUD's keys, in the shortcut store beside Tab, V, Esc and Enter (so Settings lists them, none fires while
 * a field has the keyboard, and none takes the Enter or Space that presses a focused control): B, P, M and T open the
 * selected holding's workspaces as their bubbles do, Space takes Next up's step, and I selects the next idle army (on
 * the world map only). Each acts only while its control could be pressed.
 */
export const useHudKeys = ({ idleArmies }: { idleArmies: IdleArmies }) => {
  const actions = useStructureActions();
  const latest = useRef({ actions, idleArmies });
  latest.current = { actions, idleArmies };

  useEffect(() => {
    // The world map's scene starts the manager too; the HUD's keys do not wait for it.
    getShortcutManager();
    const { addShortcut, removeShortcutsByPrefix } = useShortcutStore.getState();
    const openable = (id: string) =>
      latest.current.actions?.find((action) => action.id === id && action.refusal === null) ?? null;
    for (const [id, key] of Object.entries(ORDER_KEYS)) {
      addShortcut({
        id: `${PREFIX}${id}`,
        key: key.toLowerCase(),
        description: `Open ${id[0].toUpperCase()}${id.slice(1)}`,
        condition: () => openable(id) !== null,
        action: () => openable(id)?.onClick(),
      });
    }
    addShortcut({
      id: `${PREFIX}next-up`,
      key: " ",
      description: "Take Next up's step",
      condition: () => useNextUpShows.getState().act !== null,
      action: () => useNextUpShows.getState().act?.(),
    });
    addShortcut({
      id: `${PREFIX}idle-army`,
      key: "i",
      description: "Select the next idle army",
      condition: () => latest.current.idleArmies.refusal === null,
      action: () => selectNextIdleArmy(latest.current.idleArmies.ids),
    });
    return () => removeShortcutsByPrefix(PREFIX);
  }, []);
};
