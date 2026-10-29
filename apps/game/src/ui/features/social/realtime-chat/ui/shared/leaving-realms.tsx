import { isRealmsSite } from "@/config/app-address";
import { HudButton, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, CHAT_WORDS } from "@/ui/design-system/kit/words";
import { type ReactNode, useCallback, useState } from "react";

const openInNewTab = (url: URL) => window.open(url.href, "_blank", "noopener,noreferrer");

/**
 * A chat link pressed: one of Realms' own sites opens in a new tab at once; any other site asks first, in a window over
 * the chat that shows the whole address, its site in full strength, with Cancel and Open. There is no "always trust":
 * a trusted site is how links that drain wallets got through elsewhere. Returns the press, and the window to draw over
 * the chat while one is asked.
 */
export const useLinkOpener = (): { open: (url: URL) => void; asking: ReactNode } => {
  const [leavingFor, setLeavingFor] = useState<URL | null>(null);
  const open = useCallback((url: URL) => (isRealmsSite(url) ? openInNewTab(url) : setLeavingFor(url)), []);
  const asking = leavingFor && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-hud-well lg:p-2">
      <HudWindow title={CHAT_WORDS.leavingRealms} icon="external-link" size="fit" onClose={() => setLeavingFor(null)}>
        <p className="break-all text-hud-body text-hud-muted">
          {`${leavingFor.protocol}//`}
          <span className="text-hud-strong text-hud-ink">{leavingFor.host}</span>
          {leavingFor.href.slice(leavingFor.origin.length)}
        </p>
        <HudWindowFoot>
          <HudButton kind="secondary" onClick={() => setLeavingFor(null)}>
            {CANCEL}
          </HudButton>
          <HudButton
            kind="primary"
            onClick={() => {
              openInNewTab(leavingFor);
              setLeavingFor(null);
            }}
          >
            {CHAT_WORDS.open}
          </HudButton>
        </HudWindowFoot>
      </HudWindow>
    </div>
  );
  return { open, asking };
};
