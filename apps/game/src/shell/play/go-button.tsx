import { type IconMeaning } from "@/ui/design-system/icon";
import { useNavigate } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";

/** The kit's button for a verb that leads somewhere: a card's one action, as a route. */
export const GoButton = ({
  role,
  word,
  icon,
  to,
  onGo,
  className,
}: {
  role: "primary" | "secondary";
  word: string;
  icon: IconMeaning;
  to: string;
  /** What the tap records before it leads on. */
  onGo?: () => void;
  className?: string;
}) => {
  const navigate = useNavigate();
  return (
    <Button
      role={role}
      word={word}
      icon={icon}
      className={className}
      onClick={() => {
        onGo?.();
        navigate(to);
      }}
    />
  );
};
