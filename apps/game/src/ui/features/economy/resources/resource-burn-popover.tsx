import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudButton, HudSlider } from "@/ui/design-system/kit/hud-elements";
import { Popover } from "@/ui/design-system/molecules/popover";
import { toast } from "@/ui/features/event-feed/notify";
import { ResourceManager } from "@bibliothecadao/eternum";
import { findResourceById, RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useCallback, useId, useState } from "react";

/**
 * A resource's Burn, its own action beside its Transfer: destroys some of it at one holding, for good. One popover
 * instance per trigger, hanging off the chip or cell that opened it.
 */
export const ResourceBurnPopover = ({
  structureId,
  resourceId,
  trigger,
}: {
  structureId: number;
  resourceId: ResourcesIds;
  trigger: (toggle: () => void) => ReactNode;
}) => {
  const popoverId = `burn:${resourceId}:${useId()}`;
  const toggle = usePopoverStore((state) => state.toggle);
  const label = (findResourceById(resourceId)?.trait as string) ?? "resource";
  return (
    <Popover id={popoverId} ariaLabel={`Burn ${label}`} className="w-80" trigger={trigger(() => toggle(popoverId))}>
      <ResourceBurn structureId={structureId} resourceId={resourceId} label={label} />
    </Popover>
  );
};

const ResourceBurn = ({
  structureId,
  resourceId,
  label,
}: {
  structureId: number;
  resourceId: ResourcesIds;
  label: string;
}) => {
  const {
    setup: {
      store,
      systemCalls: { structure_burn },
    },
    account: { account },
  } = useGame();
  const tick = useCurrentDefaultTick();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  // A balance this client cannot see burns nothing.
  const held =
    (new ResourceManager(store, structureId).balanceWithProduction(tick, resourceId)?.balance ?? 0) /
    RESOURCE_PRECISION;

  const burn = useCallback(async () => {
    setBusy(true);
    try {
      await structure_burn({
        signer: account,
        structure_id: structureId,
        resources: [{ resourceId, amount: Math.round(amount * RESOURCE_PRECISION) }],
      });
      setAmount(0);
    } catch (error) {
      toast.failed(error, `Burning ${label} failed.`);
    } finally {
      setBusy(false);
    }
  }, [account, amount, label, resourceId, structureId, structure_burn]);

  return (
    <div className="ui flex flex-col gap-3">
      <p className="text-hud-muted">Permanently destroy {label} from this location. This action cannot be undone.</p>
      <HudSlider label={`${label} to burn`} value={amount} max={held} step={0.01} onChange={setAmount} />
      <div className="flex items-center justify-between">
        <span className="text-hud-label text-hud-muted">Burn amount</span>
        <span className="text-hud-strong">
          {amount.toLocaleString()} {label}
        </span>
      </div>
      <HudButton kind="danger" busy={busy ? "Burning…" : undefined} disabled={amount === 0} onClick={burn}>
        Burn {label}
      </HudButton>
    </div>
  );
};
