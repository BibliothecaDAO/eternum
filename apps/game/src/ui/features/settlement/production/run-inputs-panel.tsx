import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { heldAgainstNeed } from "@/ui/design-system/kit/words";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { resourceName } from "@bibliothecadao/types";

/**
 * What a production run burns, each input held against what the run takes, and Max, which sizes the run to what is
 * held. The inputs follow the output the player typed; undefined when the recipe is unknown here, shown as "—".
 */
export const RunInputsPanel = ({
  title,
  inputs,
  balances,
  onMax,
  onSelect,
}: {
  title: string;
  inputs: { resource: number; amount: number }[] | undefined;
  balances: Record<number, number>;
  onMax: () => void;
  onSelect: () => void;
}) => (
  <div className="cursor-pointer space-y-1" onClick={onSelect}>
    <div className="text-hud-label text-hud-muted">{title}</div>
    {inputs === undefined && <div className="text-hud-strong">—</div>}
    {inputs?.map((input) => (
      <RunInputRow key={input.resource} resource={input.resource} held={balances[input.resource]} need={input.amount} />
    ))}
    {inputs !== undefined && (
      <HudButton kind="secondary" size="sm" onClick={onMax}>
        Max
      </HudButton>
    )}
  </div>
);

/** One input of the run: its painting and what the realm holds against what the run takes, bad while short. */
const RunInputRow = ({ resource, held, need }: { resource: number; held: number | undefined; need: number }) => {
  const pair = heldAgainstNeed(held, need);
  return (
    <div role="group" aria-label={`${resourceName(resource)} for this run`} className="flex items-center gap-2 py-0.5">
      <ResourceIcon resource={resource} size="sm" withTooltip={false} />
      <span className={cn("tabular-nums text-hud-strong", (held === undefined || held < need) && "text-hud-bad")}>
        {pair}
      </span>
    </div>
  );
};
