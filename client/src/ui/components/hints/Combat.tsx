import { configManager } from "@/dojo/setup";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ResourcesIds, TROOPS_STAMINAS } from "@bibliothecadao/eternum";
import { tableOfContents } from "./utils";

export const Combat = () => {
  const troopConfig = configManager.getTroopConfig();

  const chapter = [
    {
      title: "Protecting your Structures",
      content:
        "A formidable defensive Army is vital for protecting your structures. Without it, you risk pillages and potential loss of control. A strong defense not only safeguards your assets but also deters potential raiders.",
    },
    {
      title: "Exploration",
      content: `An offensive army is crucial for exploration, engaging foes, and discovering treasures in Eternum. Your army's stamina fuels these expeditions. You can only have a certain number of attacking armies per Realm. You start at ${troopConfig.baseArmyNumberForStructure} and get ${troopConfig.armyExtraPerMilitaryBuilding} per military building.`,
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
          of the structure's resources. <br />
          The pillaging army will use up its entire stamina, but the more it has, the more resources it can retrieve.
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
        <p>
          You can exit a battle at any time, but there are consequences. Any resources your army is carrying will be
          lost, and some of your troops will desert.
        </p>
      </div>
    </div>
  );
};

const Troops = () => {
  const troopConfig = configManager.getTroopConfig();
  const advantagePercent = troopConfig.advantagePercent / 100;
  const disadvantagePercent = troopConfig.disadvantagePercent / 100;

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
            <Strength
              strength={troopConfig.knightStrength}
              strongAgainst="Paladin"
              weakAgainst="Crossbowman"
              advantagePercent={advantagePercent}
              disadvantagePercent={disadvantagePercent}
            />
          }
          health={troopConfig.health}
        />
        <TroopRow
          type="Crossbowman"
          resourceId={ResourcesIds.Crossbowman}
          strength={
            <Strength
              strength={troopConfig.crossbowmanStrength}
              strongAgainst="Knight"
              weakAgainst="Paladin"
              advantagePercent={advantagePercent}
              disadvantagePercent={disadvantagePercent}
            />
          }
          health={troopConfig.health}
        />
        <TroopRow
          type="Paladin"
          resourceId={ResourcesIds.Paladin}
          strength={
            <Strength
              strength={troopConfig.paladinStrength}
              strongAgainst="Crossbowman"
              weakAgainst="Knight"
              advantagePercent={advantagePercent}
              disadvantagePercent={disadvantagePercent}
            />
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
  return (
    <tr>
      <td className="border border-gold/10 p-2">
        <ResourceIcon resource={type} size="xxl" />
      </td>
      <td className="border border-gold/10 p-2 text-center">
        {TROOPS_STAMINAS[resourceId as keyof typeof TROOPS_STAMINAS]}
      </td>
      <td className="border border-gold/10 p-2 text-center">{strength}</td>
      <td className="border border-gold/10 p-2 text-center">{health}</td>
    </tr>
  );
};

const Strength = ({
  strength,
  strongAgainst,
  weakAgainst,
  advantagePercent,
  disadvantagePercent,
}: {
  strength: number;
  strongAgainst: string;
  weakAgainst: string;
  advantagePercent: number;
  disadvantagePercent: number;
}) => {
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
