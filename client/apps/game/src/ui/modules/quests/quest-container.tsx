import { useAddressStore } from "@/hooks/store/use-address-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getQuestLocation } from "@/ui/components/quest/quest-utils";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useMiniGames, useOwnedGames } from "metagame-sdk";
import { useMemo, useState } from "react";
import gameImage from "../../../assets/games/dark-shuffle.png";

export const QuestContainer = ({
  explorerEntityId,
  targetHex,
}: {
  explorerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { start_quest },
      components,
      components: { QuestDetails, Quest },
    },
  } = useDojo();
  const addressName = useAddressStore((state) => state.addressName) ?? "test";

  const [loading, setLoading] = useState(false);

  const selectedHex = useUIStore((state) => state.selectedHex);

  // Determine if the attacker is a structure or an explorer
  const questDetails = useMemo(() => {
    const quest = getQuestLocation(components, { x: targetHex.x, y: targetHex.y });
    return quest;
  }, [targetHex, QuestDetails]);

  console.log(targetHex, questDetails);

  const { data: miniGames } = useMiniGames({});

  console.log(miniGames);

  const queryAddress = useMemo(() => account?.address ?? "0x0", [account]);

  console.log(queryAddress);

  const { data: ownedGames } = useOwnedGames({
    address: queryAddress,
    gameAddresses: ["0x04359aee29873cd9603207d29b4140468bac3e042aa10daab2e1a8b2dd60ef7b"],
  });

  // const { data: ownedGames } = useOwnedGames({
  //   address: queryAddress,
  //   gameAddresses: ["0x04359aee29873cd9603207d29b4140468bac3e042aa10daab2e1a8b2dd60ef7b"],
  //   metagameName: "Eternum",
  //   metagameModel: "Quest",
  //   metagameAtrribute: "details_id"
  //   metagameKey: "game_token_id"
  // });

  console.log(ownedGames);

  const handleStartQuest = async () => {
    if (!selectedHex) return;

    try {
      setLoading(true);
      await start_quest({
        signer: account,
        details_id: 1,
        explorer_id: 1,
        player_name: addressName,
        to_address: account?.address,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buttonMessage = useMemo(() => {
    return "Start Quest!";
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 mx-auto max-w-full overflow-hidden">
      {" "}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4 mt-4 text-xl p-4 border panel-wood  rounded-lg backdrop-blur-sm ">
          <div className="flex flex-row gap-2">
            <h2>Quest</h2>
            <span>#100</span>
          </div>
          <div className="flex flex-col gap-2">
            Reward
            <span className="flex flex-row gap-2 items-center text-2xl font-bold text-gold">
              1000
              <ResourceIcon resource={ResourcesIds[1]} size={"sm"} />
            </span>
          </div>
          <div>Target: 1000 XP</div>
          <div>Participants: 100</div>
          <div>Time Limit: 30 mins</div>
          {/* Start Quest Button */}
          <div className="mt-2 flex justify-center">
            <Button
              variant="primary"
              className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors`}
              isLoading={loading}
              disabled={false}
              onClick={handleStartQuest}
            >
              {buttonMessage}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-4 text-xl p-4 border panel-wood  rounded-lg backdrop-blur-sm ">
          <div className="flex flex-row gap-2">
            <h2>Game Details</h2>
          </div>
          <div className="flex flex-col gap-4 mt-4 text-xl">
            <img src={gameImage} alt="Dark Shuffle" className="w-full h-auto rounded" />
            <div className="flex flex-row justify-between">
              <div className="flex flex-row gap-2">
                Game: <span>Dark Shuffle</span>
              </div>
              <div className="flex flex-row gap-2">
                Publisher: <span>Provable Games</span>
              </div>
              <div className="flex flex-row gap-2">
                Url:{" "}
                <a href="https://darkshuffle.io" target="_blank" rel="noopener noreferrer">
                  darkshuffle.io
                </a>
              </div>
            </div>
            <div>
              Description: <span>{miniGames[0]?.description}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 border panel-wood  rounded-lg backdrop-blur-sm ">
        <div>
          <h2>My Games</h2>
          {ownedGames.length > 0 ? (
            <div className="flex flex-row mt-4 gap-4">
              {ownedGames.map((game) => (
                <div
                  className="flex flex-col w-60"
                  key={game.token_id}
                  onClick={() => {
                    window.open(`https://darkshuffle.dev/play/${Number(game.token_id)}`, "_blank");
                  }}
                >
                  <div className="flex flex-row justify-between">
                    <span>Active</span>
                    <span>Below Target</span>
                  </div>
                  <img
                    src={JSON.parse(game.metadata)?.image}
                    alt={`Game #${Number(game.token_id)}`}
                    className="w-full h-auto rounded"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-row">No games found</div>
          )}
        </div>
      </div>
    </div>
  );
};
