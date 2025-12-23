import { FactoryGamesList } from "@/features/blitz-games";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { AlertCircle } from "lucide-react";

interface WorldSelectorProps {
  onSelectWorld: (worldName: string) => Promise<void> | void;
  error?: string;
  warning?: string;
  onRetry?: () => void;
}

export const WorldSelector = ({ onSelectWorld, error, warning, onRetry }: WorldSelectorProps) => {
  const message = error ?? warning;
  const isError = Boolean(error);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Card className="space-y-2 border-border/60 bg-card/80 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Game selection</div>
          <h1 className="text-lg font-semibold">Choose a world</h1>
          <p className="text-xs text-muted-foreground">Select an active Blitz game to connect your mobile client.</p>
        </Card>

        {message && (
          <Card
            className={`space-y-2 p-4 ${
              isError ? "border-destructive/40 bg-destructive/10" : "border-amber-400/40 bg-amber-200/10"
            }`}
          >
            <div className={`flex items-center gap-2 text-sm ${isError ? "text-destructive" : "text-amber-200"}`}>
              <AlertCircle className="h-4 w-4" />
              <span>{message}</span>
            </div>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry connection
              </Button>
            )}
          </Card>
        )}

        <Card className="space-y-3 border-border/60 bg-card/80 p-4">
          <div className="text-sm font-semibold">Available games</div>
          <FactoryGamesList onEnterGame={onSelectWorld} maxHeight="55vh" />
        </Card>
      </div>
    </div>
  );
};
