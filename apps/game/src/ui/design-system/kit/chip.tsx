import { type IconCode, KitIcon } from "./kit-icon";
import { formatDuration } from "./time";
import { FULL_IN } from "./words";

/** An icon (or two, overlapping) and its number on the chip token: the one way the HUD shows an amount of something. */
export const Chip = ({ icons, value, label }: { icons: IconCode[]; value: string; label: string }) => (
  <span role="img" aria-label={`${label} ${value}`} className="frontier-chip h-7 shrink-0 !py-0">
    {/* `contents` takes the chip token's fixed-size first child, so two icons keep their own size. */}
    <span className="contents">
      <span className="flex -space-x-1">
        {icons.map((icon) => (
          <KitIcon key={icon} code={icon} size={18} />
        ))}
      </span>
      <span className="frontier-chip-number tabular-nums !text-[15px]">{value}</span>
    </span>
  </span>
);

/** How long until a store or a stamina bar is full: "Full in 3h 10m", never days. */
export const FullIn = ({ seconds }: { seconds: number | undefined }) => (
  <span className="frontier-chip h-7 shrink-0 !gap-1 !px-2.5 !py-0">
    <span className="contents">
      <span className="text-[12px] font-semibold text-[color:var(--frontier-parchment)]">{FULL_IN}</span>
      <span className="frontier-chip-number tabular-nums !text-[14px]">{formatDuration(seconds)}</span>
    </span>
  </span>
);
