import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SIGN_IN } from "@/ui/design-system/kit/words";
import { RealtimeChatShell } from "@/ui/features/social";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import type { RefObject } from "react";

/**
 * Chat as a nav page on a phone: the room fills the band between the strip and the nav, which stays. Signed out, the
 * page is the way into sign-in, which brings the player back to this game.
 */
export const ChatPage = ({
  gameZoneId,
  signedIn,
  onSignIn,
  pane,
}: {
  gameZoneId: string;
  signedIn: boolean;
  onSignIn: () => void;
  /** The chat key focuses this pane's field. */
  pane: RefObject<HTMLElement>;
}) => (
  <section ref={pane} aria-label="Chat" className="flex min-h-0 flex-1 flex-col">
    <HudPanel
      collapsible={false}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      {signedIn ? (
        <RealtimeChatShell
          defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
          gameZoneId={gameZoneId}
          displayMode="embedded"
          autoInitializeClient={false}
          showInlineToggle={false}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <HudButton kind="primary" onClick={onSignIn}>
            {SIGN_IN}
          </HudButton>
        </div>
      )}
    </HudPanel>
  </section>
);
