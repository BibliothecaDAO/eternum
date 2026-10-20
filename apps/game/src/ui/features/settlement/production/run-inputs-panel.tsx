import { cn } from "@/ui/design-system/atoms/lib/utils";
import { AmountInput, HudButton } from "@/ui/design-system/kit/hud-elements";
import { heldAgainstNeed } from "@/ui/design-system/kit/words";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { resourceName } from "@bibliothecadao/types";

/** One input of a run as the panel shows it: what is held, what the run burns, and the budget typed into it, if any. */
export interface RunInput {
  resource: number;
  held: number | undefined;
  burn: number;
  short: boolean;
  /** The amount typed into this input's field, while it sizes the run. */
  budget: number | undefined;
}

/**
 * What a production run burns, each input held against what the run takes, and Max, which sizes the run to what is
 * held. Typing an input's amount spends up to that much: the run is the whole cycles it pays for, and the row shows
 * the burn they take. Undefined inputs mean the recipe is unknown here, shown as "—".
 */
export const RunInputsPanel = ({
  title,
  inputs,
  onBudget,
  onMax,
  onSelect,
}: {
  title: string;
  inputs: RunInput[] | undefined;
  onBudget: (resource: number, amount: number) => void;
  onMax: () => void;
  onSelect: () => void;
}) => (
  <div className="cursor-pointer space-y-1" onClick={onSelect}>
    <div className="text-hud-label text-hud-muted">{title}</div>
    {inputs === undefined && <div className="text-hud-strong">—</div>}
    {inputs?.map((input) => (
      <RunInputRow key={input.resource} input={input} onBudget={(amount) => onBudget(input.resource, amount)} />
    ))}
    {inputs !== undefined && (
      <HudButton kind="secondary" size="sm" onClick={onMax}>
        Max
      </HudButton>
    )}
  </div>
);

/** One input: its painting, what the realm holds against what the run burns (bad while short), and its budget field. */
const RunInputRow = ({ input, onBudget }: { input: RunInput; onBudget: (amount: number) => void }) => (
  <div
    role="group"
    aria-label={`${resourceName(input.resource)} for this run`}
    className="flex items-center gap-2 py-0.5"
  >
    <ResourceIcon resource={input.resource} size="sm" withTooltip={false} />
    <span className={cn("w-28 shrink-0 tabular-nums text-hud-strong", input.short && "text-hud-bad")}>
      {heldAgainstNeed(input.held, input.burn)}
    </span>
    <AmountInput
      label={`${resourceName(input.resource)} to spend`}
      value={input.budget ?? input.burn}
      max={Number.POSITIVE_INFINITY}
      decimals
      onChange={onBudget}
    />
  </div>
);
