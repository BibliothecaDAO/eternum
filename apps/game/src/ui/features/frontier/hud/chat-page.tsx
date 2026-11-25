import { HudButton, HudPage } from "@/ui/design-system/kit/hud-elements";
import { CHAT, SIGN_IN } from "@/ui/design-system/kit/words";
import { GameChatMap, RealtimeChatBody, RealtimeChatTabs } from "@/ui/features/social";
import type { ChatRoom } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import type { RefObject } from "react";

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
    cue={signedIn ? <RealtimeChatTabs rooms={rooms} /> : undefined}
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
