import { FactoryGamesList } from "@/features/blitz-games";
import { BlitzOnboarding } from "@/features/blitz-onboarding";
import { ROUTES } from "@/shared/consts/routes";
import { getActiveWorldName } from "@/shared/lib/world";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Link } from "@tanstack/react-router";

export function BlitzPage() {
  const activeWorldName = getActiveWorldName();

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-br from-background to-muted/20 p-4 pb-24">
      <Card className="space-y-2 border-border/60 bg-card/80 p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Active game</div>
        <div className="text-lg font-semibold">{activeWorldName ?? "Default environment"}</div>
        <p className="text-xs text-muted-foreground">
          Selecting a different game reloads the app to sync the new world.
        </p>
      </Card>

      <Card className="space-y-3 border-border/60 bg-card/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Upcoming Blitz games</h2>
            <p className="text-xs text-muted-foreground">Pick a game to register and track.</p>
          </div>
          <div className="text-xs text-muted-foreground">Auto-refresh available</div>
        </div>
        <FactoryGamesList maxHeight="380px" />
      </Card>

      <Card className="space-y-3 border-border/60 bg-card/80 p-4">
        <div>
          <h2 className="text-base font-semibold">Registration</h2>
          <p className="text-xs text-muted-foreground">Lock an entry token and join the next battle.</p>
        </div>
        <BlitzOnboarding />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="secondary" className="w-full">
          <Link to={ROUTES.LEADERBOARD}>View Leaderboard</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full">
          <Link to={ROUTES.MARKETS}>Open Prediction Markets</Link>
        </Button>
      </div>
    </div>
  );
}
