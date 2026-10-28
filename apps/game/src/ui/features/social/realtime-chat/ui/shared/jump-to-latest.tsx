import { Icon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";

/**
 * Over the foot of a chat scrolled up to read, once a newer message arrived: on the strip's ground, so it reads over the
 * messages under it. Pressed, the chat shows the latest.
 */
export const JumpToLatest = ({ onJump }: { onJump: () => void }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
    <HudPill label={CHAT_WORDS.newMessages} className="pointer-events-auto" onPress={onJump}>
      {[
        <span key="jump" className="flex items-center gap-1.5">
          <Icon name="arrow-down" size={16} />
          {CHAT_WORDS.newMessages}
        </span>,
      ]}
    </HudPill>
  </div>
);
