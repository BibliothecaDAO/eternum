import { configManager } from "@bibliothecadao/eternum";
import { formatDuration } from "@bibliothecadao/types";
import { useState } from "react";
import type { Account } from "starknet";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudRow } from "@/ui/design-system/kit/hud-elements";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import { ARMY_RELIC_MODELS, readArmyRelics } from "./army-relics";
import { relicEffect, relicIcon, relicId, relicName, type ArmyRelic } from "./relic-catalog";

/**
 * An army's relics on its panel (U4, docs/plans/frontier-season-1.md): the relics running, each with its time left, then
 * its three slots, each relic with what it does and Switch on (free, anywhere). Switching one on spends it; one of its
 * kind already running is replaced. Nothing shows before the army carries or runs a relic.
 */
export const ArmyRelicSlots = ({ explorerId }: { explorerId: number }) => {
  const { setup, account } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(ARMY_RELIC_MODELS);
  const switching = useInFlight("army", explorerId) !== undefined;
  // The slot pressed last: the one that says it is switching on while the army's order is out; the others wait.
  const [pressed, setPressed] = useState<0 | 1 | 2 | null>(null);
  const relics = readArmyRelics(setup.store, configManager.getActiveGameId(), explorerId, now);
  if (!relics || (relics.running.length === 0 && relics.slots.every((slot) => slot === null))) return null;

  const switchOn = (relic: ArmyRelic, slot: 0 | 1 | 2) => {
    setPressed(slot);
    return sendOnce("army", explorerId, { order: "use" }, () =>
      setup.systemCalls.apply_relic({
        signer: account.account as unknown as Account,
        entity_id: explorerId,
        relic_resource_id: relicId(relic),
        relic_slot: slot,
      }),
    ).catch((error: unknown) => toast.failed(error, "The relic could not be switched on."));
  };

  return (
    <section className="flex flex-col gap-1" aria-label={RELIC_WORDS.title} data-army-relics>
      {relics.running.length > 0 && (
        <div className="flex flex-wrap gap-2" data-relics-running>
          {relics.running.map((relic) => (
            <HudChip key={relic.kind} icons={[relicIcon(relic.kind)]}>
              {RELIC_WORDS.runs(relicName(relic), formatDuration(relic.secondsLeft, { days: false }))}
            </HudChip>
          ))}
        </div>
      )}
      {relics.slots.map((relic, index) => {
        const slot = index as 0 | 1 | 2;
        if (!relic) return <HudRow key={slot} title={RELIC_WORDS.empty} disabled />;
        const replaces = relics.running.some((running) => running.kind === relic.kind);
        return (
          <HudRow
            key={slot}
            lead={<Icon name={relicIcon(relic.kind)} size={22} />}
            title={relicName(relic)}
            detail={replaces ? `${relicEffect(relic)} · ${RELIC_WORDS.replacesRunning}` : relicEffect(relic)}
            controls={
              <HudButton
                kind="secondary"
                size="sm"
                disabled={switching}
                aria-label={`${RELIC_WORDS.switchOn} ${relicName(relic)}`}
                onClick={() => switchOn(relic, slot)}
              >
                {switching && pressed === slot ? RELIC_WORDS.switching : RELIC_WORDS.switchOn}
              </HudButton>
            }
          />
        );
      })}
    </section>
  );
};
