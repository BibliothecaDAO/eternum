import { useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { HudButton, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { useState } from "react";

/**
 * Delete a building: one press in Blitz and Eternum, where time is of the essence; in Frontier, where a loss asks
 * first, the press asks and OK deletes. Keyed by its building, so picking another building drops a question left
 * open.
 */
export const DestroyBuildingButton = ({ busy, onDestroy }: { busy: boolean; onDestroy: () => void }) => {
  const confirmsLoss = useConfirmsLoss();
  const [asking, setAsking] = useState(false);
  const press = () => {
    if (confirmsLoss && !asking) {
      setAsking(true);
      return;
    }
    setAsking(false);
    onDestroy();
  };
  return asking ? (
    <HudButton
      kind="danger"
      size="sm"
      icon="trash"
      onClick={press}
      disabled={busy}
      title="Confirm delete"
      aria-label="Confirm delete"
    >
      OK
    </HudButton>
  ) : (
    <HudIconButton kind="danger" icon="trash" label="Delete" title="Delete" size="sm" onClick={press} disabled={busy} />
  );
};
