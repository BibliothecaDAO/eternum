import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * A side's troops through a fight as one bar (the owner, 22 October: "Clarity is important"): the part left in the
 * side's colour, the player's green and the enemy's red, and the part the fight takes in the HUD's neutral grey.
 */
export const FightBar = ({ before, after, side }: { before: number; after: number; side: "ours" | "theirs" }) => {
  const left = before > 0 ? Math.max(0, Math.min(1, after / before)) : 0;
  return (
    <span aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-hud-well">
      <span
        className={cn("h-full", side === "ours" ? "bg-hud-good" : "bg-hud-bad")}
        style={{ width: `${left * 100}%` }}
      />
      <span className="h-full bg-hud-neutral" style={{ width: `${(1 - left) * 100}%` }} />
    </span>
  );
};
