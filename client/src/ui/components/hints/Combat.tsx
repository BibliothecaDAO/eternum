import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ConfigManager, ResourcesIds } from "@bibliothecadao/eternum";
import { tableOfContents } from "./utils";

export const Combat = () => {
  const chapter = [
    {
      title: "Protecting your Structures",
      content:
        "A formidable defensive Army is vital for protecting your structures. Without it, you risk pillages and potential loss of control. A strong defense not only safeguards your assets but also deters potential raiders.",
    },
    {
      title: "Exploration",
      content: `An offensive army is crucial for exploration, engaging foes, and discovering treasures in Eternum. Your army's stamina fuels these expeditions. You can only have a certain number of attacking armies per Realm. You start at ${EternumGlobalConfig.troop.baseArmyNumberForStructure} and get ${EternumGlobalConfig.troop.armyExtraPerMilitaryBuilding} per military building.`,
    },
    {
      title: "Battles",
      content: <Battles />,
    },
    {
      title: "Battle Chests",
      content:
        "Battle resources are locked upon engagement. Victors claim the spoils, dividing them equally among allies.",
    },

    {
      title: "Troops",
      content: <Troops />,
    },
  ];

  const chapterTitles = chapter.map((chapter) => chapter.title);

  return (
    <>
      <Headline>Combat</Headline>
      {tableOfContents(chapterTitles)}

      <p className="text-xl">
        Armies serve a multifaceted role in Eternum: they safeguard your Realm and structures while also enabling
        exploration of the vast world beyond.
      </p>

      {chapter.map((chapter) => (
        <div key={chapter.title}>
          <h2 id={chapter.title}>{chapter.title}</h2>
          {chapter.content}
        </div>
      ))}
    </>
  );
};

const Battles = () => {
  return (
    <div className="">
      <div className="flex flex-row items-center gap-2">
        <img className="w-20" src="/images/icons/attack.png" alt="coin" />
        <p>
          Battles erupt when armies clash, with duration dependent on troop numbers. These engagements are open to all,
          involving both offensive forces and defenders of structures.
        </p>
      </div>

      <div className="flex flex-row items-center gap-2">
        <img className="w-20" src="/images/icons/raid.png" alt="coin" />
        <p>
          Pillaging enemy structures becomes easier as their defensive forces weaken. Successful raids yield a portion
          of the structure's resources.
        </p>
      </div>

      <div className="flex flex-row items-center gap-2">
        <img className="w-20" src="/images/icons/claim.png" alt="coin" />
        <p>
          After overcoming enemy defenses, you can claim their structure. This transfers ownership, allowing point
          accumulation from hyperstructures or resource harvesting from mines.
        </p>
      </div>

      <div className="flex flex-row items-center gap-2">
        <img className="w-20" src="/images/icons/leave-battle.png" alt="coin" />
        <p>Exiting a battle is possible at any moment, but comes at the cost of resources, health, and troop losses.</p>
      </div>
    </div>
  );
};

const Troops = () => {
  const configManager = ConfigManager.instance();
  const troopConfig = configManager.getConfig().troop;

  return (
    <table className="not-prose w-full p-2 border-gold/10">
      <thead>
        <tr>
          <th className="p-2"></th>
          <th className="border border-gold/10 p-2">Stamina</th>
          <th className="border border-gold/10 p-2">Strength</th>
          <th className="border border-gold/10 p-2">Health</th>
        </tr>
      </thead>
      <tbody>
        <TroopRow
          type="Knight"
          resourceId={ResourcesIds.Knight}
          strength={
            <Strength strength={troopConfig.knightStrength} strongAgainst="Paladin" weakAgainst="Crossbowman" />
          }
          health={troopConfig.health}
        />
        <TroopRow
          type="Crossbowman"
          resourceId={ResourcesIds.Crossbowman}
          strength={
            <Strength strength={troopConfig.crossbowmanStrength} strongAgainst="Knight" weakAgainst="Paladin" />
          }
          health={troopConfig.health}
        />
        <TroopRow
          type="Paladin"
          resourceId={ResourcesIds.Paladin}
          strength={
            <Strength strength={troopConfig.paladinStrength} strongAgainst="Crossbowman" weakAgainst="Knight" />
          }
          health={troopConfig.health}
        />
      </tbody>
    </table>
  );
};

const TroopRow = ({
  type,
  resourceId,
  strength,
  health,
}: {
  type: string;
  resourceId: ResourcesIds;
  strength: JSX.Element;
  health: number;
}) => {
  const configManager = ConfigManager.instance();
  const troopsStaminas = configManager.getConfig().TROOPS_STAMINAS;

  return (
    <tr>
      <td className="border border-gold/10 p-2">
        <ResourceIcon resource={type} size="xxl" />
      </td>
      <td className="border border-gold/10 p-2 text-center">{troopsStaminas[resourceId]}</td>
      <td className="border border-gold/10 p-2 text-center">{strength}</td>
      <td className="border border-gold/10 p-2 text-center">{health}</td>
    </tr>
  );
};

const Strength = ({
  strength,
  strongAgainst,
  weakAgainst,
}: {
  strength: number;
  strongAgainst: string;
  weakAgainst: string;
}) => {
  const troopConfig = ConfigManager.instance().getConfig().troop;
  const advantagePercent = (troopConfig.advantagePercent / 10000) * 100;
  const disadvantagePercent = (troopConfig.disadvantagePercent / 10000) * 100;

  return (
    <div className="flex flex-col">
      {/* <div>{strength}</div> */}
      <div>
        + {advantagePercent}% vs {strongAgainst}
      </div>
      <div>
        - {disadvantagePercent}% vs {weakAgainst}
      </div>
    </div>
  );
};
