import { Eye } from "@/ui/design-system/atoms/game-icons";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "./frontier-format";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** An icon and its number on the chip token: the one way Frontier shows an amount of something. */
export const Chip = ({
  label,
  icon,
  value,
  small = false,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  /** The dock's card-scale chip. */
  small?: boolean;
}) => (
  <span aria-label={`${label} ${value}`} className={cn("frontier-chip justify-center", small && "frontier-chip-sm")}>
    {icon}
    <span className="frontier-chip-number tabular-nums">{value}</span>
  </span>
);

/** What each reveal sends home, Essence or labor; a scout's fraction of a unit shows as its eye instead. */
export const YieldChip = ({ scaled, small = false }: { scaled: bigint | undefined; small?: boolean }) => {
  const whole = scaled === undefined ? undefined : scaled / PRECISION;
  const icons =
    whole === 0n ? (
      <Eye />
    ) : (
      <span className="flex items-center justify-center -space-x-1">
        <img src={`/images/resources/${ResourcesIds.Essence}.png`} alt="" className="size-4" />
        <img src={`/images/resources/${ResourcesIds.Labor}.png`} alt="" className="size-4" />
      </span>
    );
  return (
    <Chip
      label="Each reveal"
      small={small}
      icon={icons}
      value={whole === undefined ? "—" : whole === 0n ? "" : formatAmount(Number(whole))}
    />
  );
};
