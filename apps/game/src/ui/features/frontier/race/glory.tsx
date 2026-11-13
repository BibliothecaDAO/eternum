import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { GLORY_MEANING } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { GLORY_WORDS } from "@/ui/design-system/kit/words";
import { readHomeGlory } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount } from "@bibliothecadao/types";

import { useOpens } from "../opening/use-opening";

const GLORY_MODELS = ["RaceRules", "RaceMember", "Structure"] as const;

/**
 * The player's own realm's Glory, the one score a member reads, once the Deep opened it (opening.ts): its points, null
 * while the snapshot cannot tell them, none in a game without the race or before the realm went into the Deep.
 */
export const useOwnGlory = (realm: NativeRows["Structure"] | null): number | null | undefined => {
  const { setup } = useGame();
  const opens = useOpens("glory");
  useNativeRevision(GLORY_MODELS);
  if (!realm || !opens) return undefined;
  const glory = readHomeGlory(setup.store, realm.game_id, safeInteger(realm.entity_id));
  return glory === undefined ? undefined : (glory.known ?? null);
};

/** The phone's purse: the realm's Glory beside the Realms chip; a dash while it is read. */
export const GloryPill = ({ glory }: { glory: number | null }) => (
  <HudPill label={GLORY_WORDS.line(glory)} data-tip={GLORY_WORDS.tip} role="img">
    {[
      <span key="glory" className="flex items-center gap-1.5 tabular-nums">
        <Icon name={GLORY_MEANING} size={26} />
        {glory === null ? "—" : formatAmount(glory)}
      </span>,
    ]}
  </HudPill>
);
