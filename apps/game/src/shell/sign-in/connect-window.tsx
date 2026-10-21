import { Icon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useSheetCloses } from "@/ui/design-system/kit/sheet-closes";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { CLOSE } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { useLayout } from "../frame/layout";

/**
 * Connect, over the page the player is on: a window in the page's middle on desktop, a sheet from the foot on a phone.
 * Brooding Plains heads it, the step's title at its foot. It closes from its cross, a press beside it,
 * Escape or the system back, and the page under it never moves. It carries the shell's surface, so it draws the same
 * over a game.
 */
export const ConnectWindow = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  useSheetCloses(onClose);
  const phone = useLayout() === "phone";
  return (
    <div
      data-surface="shell"
      className={cn("app-scrim", phone && "app-scrim--sheet")}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-label={title}
        className="app-connect"
        data-layout={phone ? "phone" : "desktop"}
      >
        <header className="app-connect__head">
          <img className="app-connect__painting" alt="" {...paintingSources("brooding-plains")} sizes="30rem" />
          <h2>{title}</h2>
          <button type="button" className="app-connect__close" aria-label={CLOSE} onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="app-connect__body">{children}</div>
      </section>
    </div>
  );
};
