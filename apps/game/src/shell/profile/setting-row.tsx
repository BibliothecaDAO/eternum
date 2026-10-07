import type { ReactNode } from "react";

import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";

/**
 * A setting as one row (spec 10-12): its icon, its name, its value (a word or data), and a chevron, or a control at its
 * end. The whole row taps.
 */
export const SettingRow = ({
  icon,
  name,
  value,
  end,
  onOpen,
}: {
  icon: IconCode;
  name: string;
  value?: ReactNode;
  /** A control at the row's end in place of the chevron (a switch, a step). */
  end?: ReactNode;
  onOpen?: () => void;
}) => {
  const face = (
    <>
      <KitIcon code={icon} size={24} />
      <span className="font-ui text-[16px] font-semibold text-kit-cream">{name}</span>
      <span className="ml-auto min-w-0 truncate text-right text-[15px] text-kit-muted">{value}</span>
      {end ?? (onOpen && <KitIcon code="Cv" size={18} />)}
    </>
  );
  const row = "flex min-h-14 w-full items-center gap-3 border-b border-kit-line px-2 last:border-b-0";
  return onOpen && !end ? (
    <button type="button" onClick={onOpen} className={row}>
      {face}
    </button>
  ) : (
    <div className={row}>{face}</div>
  );
};

/** Rows on one opaque plate. */
export const SettingRows = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-kit-line bg-kit-plate">{children}</div>
);
