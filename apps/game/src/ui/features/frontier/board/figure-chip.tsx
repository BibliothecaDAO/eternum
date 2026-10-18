import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

/**
 * An amount of something on the sheet's chip: its icons and its number (a unit word after it where no icon names it),
 * named in full for assistive technology, with a fuller line on the app's tooltip where the facts have one.
 */
export const FigureChip = ({
  icons,
  label,
  value,
  unit,
  tip,
}: {
  icons: readonly IconMeaning[];
  label: string;
  value: string;
  unit?: string;
  tip?: string;
}) => (
  <span role="img" aria-label={`${label} ${value}`} data-tip={tip} className="inline-flex shrink-0">
    <HudChip>
      {icons.map((icon) => (
        <Icon key={icon} name={icon} size={16} />
      ))}
      <span className="tabular-nums">{value}</span>
      {unit && <span>{unit}</span>}
    </HudChip>
  </span>
);
