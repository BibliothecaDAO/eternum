import { Button } from "@/ui/design-system/kit/button";
import { SIGN_IN } from "@/ui/design-system/kit/words";
import { RealtimeChatShell } from "@/ui/features/social";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

/**
 * Chat as a nav page on a phone: the room fills the band between the strip and the nav, which stays. Signed out, the
 * page is the way into sign-in, which brings the player back to this game.
 */
export const ChatPage = ({
  gameZoneId,
  signedIn,
  onSignIn,
}: {
  gameZoneId: string;
  signedIn: boolean;
  onSignIn: () => void;
}) => (
  <section
    aria-label="Chat"
    className="frontier-card pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden !rounded-xl"
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
        <Button role="primary" word={SIGN_IN} onClick={onSignIn} />
      </div>
    )}
  </section>
);
