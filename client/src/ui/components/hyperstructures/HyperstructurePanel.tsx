import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { calculateCompletionPoints } from "@/dojo/modelManager/utils/LeaderboardUtils";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useContributions } from "@/hooks/helpers/useContributions";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import {
  ProgressWithPercentage,
  useHyperstructureProgress,
  useHyperstructureUpdates,
} from "@/hooks/helpers/useHyperstructures";
import { useHyperstructureData } from "@/hooks/store/useLeaderBoardStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, getEntityIdFromKeys, multiplyByPrecision, separateCamelCase } from "@/ui/utils/utils";
import { Access, ContractAddress, MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";
import { ContributionSummary } from "./ContributionSummary";
import { HyperstructureDetails } from "./HyperstructureDetails";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";

enum DisplayedAccess {
  Public = "Public",
  Private = "Private",
  GuildOnly = "Tribe Only",
}

enum Loading {
  None,
  Contribute,
  ChangeName,
  SetPrivate,
}

export const HyperstructurePanel = ({ entity }: any) => {
  const dojo = useDojo();

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { contribute_to_construction, set_access },
      components: { Hyperstructure },
    },
  } = dojo;

  const { getGuildFromPlayerAddress } = useGuilds();

  const updateLeaderboard = useHyperstructureData();

  const [isLoading, setIsLoading] = useState<Loading>(Loading.None);
  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [resetContributions, setResetContributions] = useState(false);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const progresses = useHyperstructureProgress(entity.entity_id);

  const { useContributionsByPlayerAddress } = useContributions();

  const myContributions = useContributionsByPlayerAddress(BigInt(account.address), entity.entity_id);

  const updates = useHyperstructureUpdates(entity.entity_id);

  const [newContributions, setNewContributions] = useState<Record<number, number>>({});

  const { getAddressNameFromEntity } = useEntitiesUtils();
  const ownerName = getAddressNameFromEntity(entity.entity_id);

  const hyperstructure = useComponentValue(Hyperstructure, getEntityIdFromKeys([BigInt(entity.entity_id)]));

  const playerGuild = useMemo(() => getGuildFromPlayerAddress(ContractAddress(account.address)), []);

  const contributeToConstruction = async () => {
    const formattedContributions = Object.entries(newContributions).map(([resourceId, amount]) => ({
      resource: Number(resourceId),
      amount: multiplyByPrecision(amount + 1), // add 1 to the amount to account for precision loss in client
    }));

    setIsLoading(Loading.Contribute);
    setResetContributions(true);

    try {
      await contribute_to_construction({
        signer: account,
        contributions: formattedContributions,
        contributor_entity_id: structureEntityId,
        hyperstructure_entity_id: entity.entity_id,
      });
    } finally {
      setIsLoading(Loading.None);
      setNewContributions({});
      setResetContributions(false);
    }
  };

  const resourceElements = useMemo(() => {
    if (progresses.percentage === 100) return;

    return Object.values(configManager.getHyperstructureRequiredAmounts(entity.entity_id)).map(({ resource }) => {
      const progress = progresses.progresses.find(
        (progress: ProgressWithPercentage) => progress.resource_type === resource,
      );
      return (
        <HyperstructureResourceChip
          structureEntityId={structureEntityId}
          setContributions={setNewContributions}
          contributions={newContributions}
          progress={progress!}
          key={resource}
          resourceId={resource}
          resetContributions={resetContributions}
        />
      );
    });
  }, [progresses, myContributions]);

  const canContribute = useMemo(() => {
    const hyperstructureOwnerGuild = getGuildFromPlayerAddress(BigInt(entity?.owner || 0));
    return (
      entity.isOwner ||
      (hyperstructure?.access === Access[Access.GuildOnly] &&
        playerGuild?.entityId !== undefined &&
        playerGuild.entityId !== 0 &&
        hyperstructureOwnerGuild?.entityId !== undefined &&
        hyperstructureOwnerGuild.entityId !== 0 &&
        hyperstructureOwnerGuild.entityId === playerGuild.entityId) ||
      hyperstructure?.access === Access[Access.Public]
    );
  }, [newContributions]);

  const initialPoints = useMemo(() => {
    return calculateCompletionPoints(myContributions);
  }, [myContributions, updates]);

  const myShares = useMemo(() => {
    return LeaderboardManager.instance(dojo).getAddressShares(ContractAddress(account.address), entity.entity_id);
  }, [myContributions, updates]);

  const setAccess = async (access: bigint) => {
    setIsLoading(Loading.SetPrivate);
    try {
      await set_access({
        signer: account,
        hyperstructure_entity_id: entity.entity_id,
        access,
      });
    } finally {
      setIsLoading(Loading.None);
      setNewContributions({});
      setResetContributions(false);
    }
  };

  const [selectedAccess, setSelectedAccess] = useState<"Public" | "Private" | "GuildOnly">(
    hyperstructure
      ? (DisplayedAccess[hyperstructure.access as keyof typeof DisplayedAccess] as "Public" | "Private" | "GuildOnly")
      : "Private",
  );

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col bg-blueish/10 p-2">
        <div className="flex">
          {/* Owner Column */}
          <div className="flex flex-col min-w-[120px] mr-4">
            <div className="text-xxs uppercase text-gold/80">Owner</div>
            <h5 className="text-sm truncate">{ownerName}</h5>
          </div>

          {/* Name & Controls Column */}
          <div className="flex-1">
            {editName ? (
              <div className="flex gap-2">
                <TextInput
                  placeholder="Type Name"
                  className="flex-1"
                  onChange={(name) => setNaming(name)}
                  maxLength={MAX_NAME_LENGTH}
                />
                <Button
                  variant="default"
                  isLoading={isLoading === Loading.ChangeName}
                  disabled={isLoading !== Loading.None}
                  onClick={async () => {
                    setIsLoading(Loading.ChangeName);

                    try {
                      await provider.set_entity_name({ signer: account, entity_id: entity.entity_id, name: naming });
                    } catch (e) {
                      console.error(e);
                    }

                    setIsLoading(Loading.None);
                    setEditName(false);
                  }}
                >
                  Change Name
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 justify-between w-full">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1">
                    <h4 className="truncate">{entity.name}</h4>
                    <Button size="xs" onClick={updateLeaderboard}>
                      Reload
                    </Button>
                  </div>
                </div>

                {account.address === entity.owner && (
                  <div className="flex flex-col gap-2">
                    {hyperstructure && entity.isOwner && isLoading !== Loading.SetPrivate ? (
                      <Select
                        onValueChange={(access: keyof typeof Access) => {
                          setSelectedAccess(access);
                          setAccess(BigInt(Access[access]));
                        }}
                      >
                        <SelectTrigger className="w-[140px] text-gold h-8 text-sm border border-gold/20">
                          <SelectValue
                            placeholder={DisplayedAccess[hyperstructure.access as keyof typeof DisplayedAccess]}
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 text-gold">
                          {Object.keys(Access)
                            .filter((access) => {
                              if (!isNaN(Number(access))) return false;

                              if (access === Access[Access.GuildOnly]) {
                                return playerGuild?.entityId !== undefined && playerGuild.entityId !== 0;
                              }

                              return access !== hyperstructure!.access;
                            })
                            .map((access) => (
                              <SelectItem key={access} value={access} disabled={!entity.isOwner}>
                                {separateCamelCase(access)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-gold text-sm">Loading...</div>
                    )}

                    {account.address === entity.owner && (
                      <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
                        edit name
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 w-full mb-1">
        <div className="flex flex-col justify-center items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Initial points</div>
          <div className="font-bold text-sm">{currencyIntlFormat(initialPoints)}</div>
        </div>
        <div className="flex flex-col justify-center items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Progress</div>
          <div className="font-bold text-sm">{currencyIntlFormat(progresses.percentage)}%</div>
        </div>
        <div className="flex flex-col justify-center items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Shares</div>
          <div className="font-bold text-sm">{currencyIntlFormat((myShares || 0) * 100)}%</div>
        </div>
        <div className="flex flex-col justify-center items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Points/cycle</div>
          <div className="font-bold text-sm">
            {currencyIntlFormat((myShares || 0) * configManager.getHyperstructureConfig().pointsPerCycle)}
          </div>
        </div>
      </div>
      <div className="overflow-y-scroll no-scrollbar h-[40vh] bg-gold/10  p-2">
        <ContributionSummary hyperstructureEntityId={entity.entity_id} className="mb-1" />
        {progresses.percentage === 100 ? (
          <HyperstructureDetails hyperstructureEntityId={entity.entity_id} />
        ) : (
          <div className="">
            {resourceElements}
            <div className="flex justify-end w-full mt-2">
              <div
                onMouseEnter={() => {
                  if (!canContribute) {
                    setTooltip({
                      content: <>Not the correct access</>,
                      position: "right",
                    });
                  }
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
              >
                <Button
                  isLoading={isLoading === Loading.Contribute}
                  variant="primary"
                  disabled={Object.keys(newContributions).length === 0 || isLoading !== Loading.None || !canContribute}
                  onClick={contributeToConstruction}
                >
                  Contribute To Construction
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
