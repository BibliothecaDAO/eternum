import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const Points = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Points</CardTitle>
          <CardDescription>Path to victory in Eternum</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Winning with Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Points are needed for victory in Eternum. You can only generate them via constructing Hyperstructures.
              Once built, Hyperstructures generate points per tick.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ending the Game</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The game ends when a player reaches the victory threshold and they call an end to the game. Only this
              player can end the game, no one else can. The game will continue until this player decides to end it, or
              another player gets enough points to surpass the victory threshold.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
