import { type IconCode, KitIcon } from "./kit-icon";
import { formatDuration } from "./time";
import { FULL_IN } from "./words";

/**
 * An icon (or two, overlapping) and its number on the chip token: the one way the HUD shows an amount of something. A
 * unit word follows the number where there is no icon for it (XP); ember marks a cost that is short.
 */
export const Chip = ({
  icons,
  value,
  label,
  unit,
  ember = false,
}: {
  icons: IconCode[];
  value: string;
  label: string;
  unit?: string;
  ember?: boolean;
}) => (
  <span
    role="img"
    aria-label={`${label} ${value}`}
    data-tone={ember ? "loss" : undefined}
    className="frontier-chip h-7 shrink-0 !py-0"
  >
    {/* `contents` takes the chip token's fixed-size first child, so two icons keep their own size. */}
    <span className="contents">
      <span className="flex -space-x-1">
        {icons.map((icon) => (
          <KitIcon key={icon} code={icon} size={18} />
        ))}
      </span>
      <span className="frontier-chip-number tabular-nums !text-[15px]">{value}</span>
      {unit && <span className="text-[13px] font-semibold text-kit-cream">{unit}</span>}
    </span>
  </span>
);

/** How long until a store or a stamina bar is full: "Full in 3h 10m", never days. */
export const FullIn = ({ seconds }: { seconds: number | undefined }) => (
  <span className="frontier-chip h-7 shrink-0 !gap-1 !px-2.5 !py-0">
    <span className="contents">
      <span className="text-[12px] font-semibold text-kit-cream">{FULL_IN}</span>
      <span className="frontier-chip-number tabular-nums !text-[14px]">{formatDuration(seconds)}</span>
    </span>
  </span>
);
