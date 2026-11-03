import { HudButton, HudPage } from "@/ui/design-system/kit/hud-elements";
import { CHAT, SIGN_IN } from "@/ui/design-system/kit/words";
import { GameChatMap, RealtimeChatBody, RealtimeChatOnline, RealtimeChatTabs } from "@/ui/features/social";
import type { ChatRoom } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import type { RefObject } from "react";

/**
 * Chat as a nav page on a phone, in the one frame: it fills the band between the strip and the nav. Its rooms' tabs
 * stand in the head row in the page's name's place, the players online beside its cross, so the history keeps the row
 * a title took; while the keyboard is up the strip steps aside too (HudBands), leaving the tabs, the history and the
 * field (owner, 3 November 2026: "B for the chat change"). Signed out, the page is the way into sign-in, which brings
 * the player back to this game.
 */
export const ChatPage = ({
  rooms,
  signedIn,
  onSignIn,
  pane,
  onClose,
}: {
  rooms: readonly ChatRoom[];
  signedIn: boolean;
  onSignIn: () => void;
  /** The chat key focuses this pane's field. */
  pane: RefObject<HTMLElement>;
  onClose: () => void;
}) => (
  // The chat body pads its own history and composer.
  <HudPage
    ref={pane}
    label={CHAT}
    icon="chat"
    nav={signedIn ? <RealtimeChatTabs rooms={rooms} /> : undefined}
    cue={signedIn ? <RealtimeChatOnline /> : undefined}
    fills
    onClose={onClose}
    bodyClassName="gap-0 p-0"
  >
    {signedIn ? (
      <GameChatMap>
        <RealtimeChatBody rooms={rooms} />
      </GameChatMap>
    ) : (
      <div className="flex flex-1 items-center justify-center p-4">
        <HudButton kind="primary" onClick={onSignIn}>
          {SIGN_IN}
        </HudButton>
      </div>
    )}
  </HudPage>
);
