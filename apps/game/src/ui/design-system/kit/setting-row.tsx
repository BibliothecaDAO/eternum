import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { ListRow } from "./list-row";

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
  icon: IconMeaning;
  name: string;
  value?: ReactNode;
  /** A control at the row's end in place of the chevron (a switch, a step). */
  end?: ReactNode;
  onOpen?: () => void;
  /** Another site, opened in a new tab. */
  href?: string;
}) => {
  const opens = Boolean(onOpen || href);
  const action = href ? { href } : onOpen && !end ? { onClick: onOpen } : {};
  return (
    <ListRow
      {...action}
      height={14}
      gap={3}
      lead={<SemanticIcon name={icon} size={24} />}
      trailing={end}
      chevron={(end === undefined || end === null) && opens}
      className="w-full px-2"
    >
      <span className="min-w-0 text-left font-ui text-base font-semibold text-kit-cream">{name}</span>
      <span className="ml-auto max-w-[50%] shrink-0 truncate text-right text-base text-kit-muted">{value}</span>
    </ListRow>
  );
};

/** Rows on one opaque plate. */
export const SettingRows = ({ children }: { children: ReactNode }) => <div className="plate">{children}</div>;
