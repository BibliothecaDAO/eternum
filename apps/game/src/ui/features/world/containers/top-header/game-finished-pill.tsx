import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { resetBootstrap } from "@/init/bootstrap";
import Button from "@/ui/design-system/atoms/button";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Popover } from "@/ui/design-system/molecules/popover";
import TrophyIcon from "lucide-react/dist/esm/icons/trophy";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TOP_PILL, TOP_PILL_TEXT } from "./top-pill";

const GAME_FINISHED_POPOVER_ID = "game-finished";

/**
 * The finished-game surface: a pill where the timer was, with the review and the dashboard one popover away. The
 * map stays reachable — a finished game is still worth looking at.
 */
export const GameFinishedPill = () => {
  const isOpen = usePopoverStore((state) => state.openId === GAME_FINISHED_POPOVER_ID);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const navigate = useNavigate();
  const goToReview = useCallback(() => {
    resetBootstrap();
    navigate("/");
  }, [navigate]);

  return (
    <Popover
      id={GAME_FINISHED_POPOVER_ID}
      ariaLabel="Game finished"
      trigger={
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => togglePopover(GAME_FINISHED_POPOVER_ID)}
          className={cn(
            TOP_PILL,
            TOP_PILL_TEXT,
            "game-finished-pill whitespace-nowrap transition hover:bg-gold/15",
            isOpen && "border-gold/60 bg-gold/15",
          )}
        >
          <TrophyIcon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          <span>Game finished</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <span className={HUD_HEADLINE}>This game has ended</span>
        <span className={HUD_BODY}>
          The review, standings and rewards are on the dashboard. The map stays open here.
        </span>
        <Button variant="gold" size="xs" className="w-full justify-center" onClick={goToReview}>
          Go to the review
        </Button>
      </div>
    </Popover>
  );
};
