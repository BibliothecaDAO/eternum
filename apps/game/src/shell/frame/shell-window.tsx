import "@/ui/design-system/kit/app-sheet.css";

import { Icon } from "@/ui/design-system/icon";
import { AppModalLayer } from "@/ui/design-system/kit/app-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { CLOSE } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { useLayout } from "./layout";

/**
 * A window over the page the player is on (Connect, a holding's sheet): in the page's middle on desktop, a sheet from the
 * foot on a phone. Brooding Plains heads it, its title at its foot. It is the app's modal layer: the page under it is
 * dimmed and inert, never moves, and it closes from its cross, a press beside it, Escape or the system back. It carries
 * the shell's surface, so it draws the same over a game.
 */
export const ShellWindow = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const phone = useLayout() === "phone";
  return (
    <AppModalLayer onClose={onClose} sheet={phone}>
      <section
        role="dialog"
        aria-modal
        aria-label={title}
        className="app-window"
        data-layout={phone ? "phone" : "desktop"}
      >
        <header className="app-window__head">
          <img className="app-window__painting" alt="" {...paintingSources("brooding-plains")} sizes="30rem" />
          <h2>{title}</h2>
          <button type="button" className="app-window__close" aria-label={CLOSE} onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="app-window__body">{children}</div>
      </section>
    </AppModalLayer>
  );
};
