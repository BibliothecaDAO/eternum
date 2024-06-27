export const Combat = () => {
  return (
    <div>
      <p className="text-xl">
        Armies allow you to protect your Realm, your structures but also allow you to explore the Eternum.
      </p>
      <h1>Defensive</h1>
      <h4>Protecting your Structures (Realm, Hyperstructures and Earthenshard mines)</h4>
      <p>
        To protect your Base you must create a defensive Army. Without one, you will be more vulnerable to pillages.
        Raider can also claim your structures as their own if your defensive army is inexistant or dead.
      </p>
      <h1>Offensive</h1>
      <h4>Exploration</h4>
      <p>
        Without an attack army, you won't be able to start exploring the map, to find opponents, to discover the hidden
        treasures of Eternum
      </p>
      <h4>Battles</h4>
      <p>
        If you catch someone or get caught in the open, you may end up in a battle against an opponent. These last a
        variable amount of time, depending on the difference of troops between yours and your opponent's army.
        <br /> Anyone can join a battle, as long as there's at least one person in any side of the battle.
        <br />
        You can engage in battle with an opponent's offensive army or a structure's defensive army.
      </p>
      <h4>Battle chests</h4>
      <p>
        Each armies' resources get locked at the beginning of a battle. The winning side takes it all, split equally
        amongst all participant.
      </p>
      <h4>Pillaging</h4>
      <p>
        You can pillage an opponent's structure. The less health and troops the defensive army has, the more chance you
        have of pillaging successfully. In case of success, you will get some of the structure's resources.
      </p>
      <h4>Claiming a structure</h4>
      <p>
        If the opponent's structure's defensive army is defeated (or simply isn't present), you can claim the structure
        it protected, you will gain ownership of that structure.
        <br /> If it was a finished hyperstructure you will start accumulating points.
        <br /> If it was a mine, you will be able to claim its earthenshards.
      </p>
      <h4>Leaving a battle</h4>
      <p>
        You can decide that you want to leave a battle at any time. However, you will lose your resources as well as
        some health and troops.
      </p>
    </div>
  );
};
