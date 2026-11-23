import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { HudNotice, HudPage } from "@/ui/design-system/kit/hud-elements";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useDockArmies } from "../hud/dock-armies";
import { ARMY_RELIC_MODELS, readRealmArmyRelics } from "./army-relics";
import { ArmyRelicSlots } from "./army-relic-slots";

export const FrontierRelics = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(ARMY_RELIC_MODELS);
  const armies = useDockArmies(realm);
  const withRelics = readRealmArmyRelics(setup.store, realm.game_id, armies, now);

  return (
    <HudPage label={RELIC_WORDS.title} icon="relics" onClose={onClose} bodyClassName="flex flex-col gap-3">
      {withRelics.length === 0 ? (
        <HudNotice icon="relics" line={RELIC_WORDS.empty} />
      ) : (
        withRelics.map(({ army }) => (
          <div key={army.explorerId} className="flex flex-col gap-2">
            <p className="text-hud-label uppercase tracking-wide text-hud-muted">{army.label}</p>
            <ArmyRelicSlots explorerId={army.explorerId} />
          </div>
        ))
      )}
    </HudPage>
  );
};
