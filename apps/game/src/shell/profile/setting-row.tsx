import type { ReactNode } from "react";

import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";

/**
 * A setting as one row (spec 10-12): its icon, its name, its value (a word or data), and a chevron, or a control at its
 * end. The whole row taps; a row with an address is a link that opens it in a new tab.
 */
export const SettingRow = ({
  icon,
  name,
  value,
  end,
  onOpen,
  href,
}: {
  icon: IconCode;
  name: string;
  value?: ReactNode;
  /** A control at the row's end in place of the chevron (a switch, a step). */
  end?: ReactNode;
  onOpen?: () => void;
  /** Another site, opened in a new tab. */
  href?: string;
}) => {
  const face = (
    <>
      <KitIcon code={icon} size={24} />
      <span className="min-w-0 text-left font-ui text-[16px] font-semibold text-kit-cream">{name}</span>
      <span className="ml-auto max-w-[50%] shrink-0 truncate text-right text-[15px] text-kit-muted">{value}</span>
      {end ?? ((onOpen || href) && <KitIcon code="Cv" size={18} />)}
    </>
  );
  const row = "flex min-h-14 w-full items-center gap-3 border-b border-kit-line px-2 last:border-b-0";
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={row}>
        {face}
      </a>
    );
  return onOpen && !end ? (
    <button type="button" onClick={onOpen} className={row}>
      {face}
    </button>
  ) : (
    <div className={row}>{face}</div>
  );
};

/** Rows on one opaque plate. */
export const SettingRows = ({ children }: { children: ReactNode }) => <div className="plate">{children}</div>;
