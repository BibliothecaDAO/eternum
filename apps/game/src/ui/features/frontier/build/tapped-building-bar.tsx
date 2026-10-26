import { Icon } from "@/ui/design-system/icon";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { toast } from "@/ui/features/event-feed/notify";
import { DestroyBuildingButton } from "@/ui/features/world/components/bottom-right-panel/destroy-building-button";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { type TappedBuilding, useStillStands } from "../research/selected-building";
import { buildingIcon, buildingName } from "./building-names";

/**
 * The building the player tapped on their realm's board, over its Research: its name and Demolish (owner, 2026-10-26:
 * "demolish is not exposed in the frontier client which is a mistake tbh"). Demolish asks first and deletes on OK, as
 * a loss does in Frontier (DestroyBuildingButton); the game refunds part of its cost and the day's log says
 * "Demolished: Farm". Gone once the building no longer stands.
 */
export const TappedBuildingBar = ({
  realm,
  building: tapped,
}: {
  realm: NativeRows["Structure"];
  building: TappedBuilding;
}) => {
  const stands = useStillStands(realm, tapped);
  const [busy, setBusy] = useState(false);
  if (!stands) return null;
  const demolish = async () => {
    setBusy(true);
    try {
      await requireActiveGameClient().actions.destroyBuilding({
        structureId: safeInteger(realm.entity_id),
        hex: { col: tapped.innerCol, row: tapped.innerRow },
      });
    } catch (error) {
      toast.failed(error, "The building could not be demolished.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-frontier-tapped-building className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon name={buildingIcon(tapped.category)} size={28} />
        <span className="flex-1 text-hud-strong text-hud-ink">{buildingName(tapped.category)}</span>
        <DestroyBuildingButton key={`${tapped.innerCol}:${tapped.innerRow}`} busy={busy} onDestroy={demolish} />
      </div>
    </div>
  );
};
