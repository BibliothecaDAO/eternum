import { Headline } from "@/ui/design-system/molecules/headline";

export const Points = () => {
  return (
    <div className="space-y-8">
      <Headline>Points</Headline>

      <section className="space-y-4">
        <h4>Winning with Points</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Points are needed for victory in Realms. You can only generate them via constructing Hyperstructures. Once
            built, Hyperstructures generate points per tick.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Ending the Game</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            The game ends when a player reaches the victory threshold and they call an end to the game. Only this player
            can end the game, no one else can. The game will continue until this player decides to end it, or another
            player gets enough points to surpass the victory threshold.
          </p>
        </div>
      </section>
    </div>
  );
};
