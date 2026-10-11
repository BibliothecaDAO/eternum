import type { ReactNode } from "react";

import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";

/** A titled plate: its icon and title over a gold rule (desktop), a figure at the title's end, then its rows. */
export const Panel = ({
  icon,
  title,
  aside,
  children,
}: {
  icon: IconCode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="plate flex flex-col gap-1 p-3">
    <h2 className="plate-title flex items-center gap-2 px-1 font-ui text-[15px] font-bold text-kit-cream">
      <KitIcon code={icon} size={22} />
      {title}
      {aside && <span className="ml-auto">{aside}</span>}
    </h2>
    {children}
  </section>
);
