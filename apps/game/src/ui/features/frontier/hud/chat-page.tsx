import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SIGN_IN } from "@/ui/design-system/kit/words";
import { GameChatMap, RealtimeChatShell } from "@/ui/features/social";
import type { ChatRoom } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import type { RefObject } from "react";

/**
 * Chat as a nav page on a phone: the room fills the band between the strip and the nav, which stays. Signed out, the
 * page is the way into sign-in, which brings the player back to this game.
 */
export const ChatPage = ({
  rooms,
  signedIn,
  onSignIn,
  pane,
}: {
  rooms: readonly ChatRoom[];
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
        <GameChatMap>
          <RealtimeChatShell rooms={rooms} className="min-h-0 flex-1" />
        </GameChatMap>
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
