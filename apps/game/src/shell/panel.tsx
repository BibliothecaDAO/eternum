import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

/** A titled plate: its icon and title over a gold rule (desktop), a figure at the title's end, then its rows. */
export const Panel = ({
  icon,
  title,
  aside,
  children,
}: {
  icon: IconMeaning;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="plate flex flex-col gap-1 p-3">
    <h2 className="plate-title flex items-center gap-2 px-1 font-body text-base font-bold text-kit-cream">
      <SemanticIcon name={icon} size={22} />
      {title}
      {aside && <span className="ml-auto">{aside}</span>}
    </h2>
    {children}
  </section>
);
