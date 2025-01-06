export const Points = () => {
  return (
    <div>
      <h2>Winning with Points</h2>
      <p>
        Points are needed for victory in Eternum. You can only generate them via constructing Hyperstructures. Once
        built, Hyperstructures generate points per tick. The owner of the Hyperstructure can spend these points on
        powerful abilities.
      </p>

      <h3>Ending the Game</h3>
      <p>
        The game ends when a player reaches the victory threshold and they call an end to the game. Only this player can
        end the game, no one else can. The game will continue until this player decides to end it, or another player
        gets enough points to surpass the victory threshold.
      </p>
    </div>
  );
};
