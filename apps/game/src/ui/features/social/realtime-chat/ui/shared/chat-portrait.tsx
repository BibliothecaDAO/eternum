import { cn } from "@/ui/design-system/atoms/lib/utils";

import { useChatPeople } from "../../hooks/use-chat-people";

const SIZES = { sm: "h-6 w-6", lg: "h-10 w-10" } as const;

/**
 * A chat player's portrait, as identity has it (useChatPeople): their chosen one, else their account's stock one; until
 * their profile is known, an empty plate, never a face that may not be theirs.
 */
export const ChatPortrait = ({
  playerId,
  size = "sm",
  className,
}: {
  playerId: string;
  size?: keyof typeof SIZES;
  className?: string;
}) => {
  const src = useChatPeople().portraitOf(playerId);
  const box = cn("shrink-0 overflow-hidden rounded", SIZES[size], className);
  return src ? (
    <img src={src} alt="" className={cn(box, "object-cover")} />
  ) : (
    <span aria-hidden className={cn(box, "block bg-hud-well")} />
  );
};
