import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import TextInput from "@/ui/design-system/atoms/text-input";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { HyperstructureDetails } from "@/ui/features/infrastructure/hyperstructures/hyperstructure-details";
import { HyperstructureResourceChip } from "@/ui/features/infrastructure/hyperstructures/hyperstructure-resource-chip";
import { currencyIntlFormat, formatStringNumber, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  getAddressNameFromEntity,
  getGuildFromPlayerAddress,
  getHyperstructureTotalContributableAmounts,
  LeaderboardManager,
  multiplyByPrecision,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useCurrentAmounts, useDojo, useHyperstructureProgress, useHyperstructureUpdates } from "@bibliothecadao/react";
import { Access, ContractAddress, MAX_NAME_LENGTH, RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";

// Add the initialize type to the system calls
declare module "@bibliothecadao/react" {
  interface SystemCalls {
    initialize: (props: { signer: any; hyperstructure_id: number }) => Promise<void>;
  }
}

export enum DisplayedAccess {
  Public = "Public",
  Private = "Private",
  GuildOnly = "Tribe Only",
}

enum Loading {
  None,
  Contribute,
  ChangeName,
  SetPrivate,
  Initialize,
}

export const HyperstructurePanel = ({ entity }: any) => {
  const dojo = useDojo();

  const {
    account: { account },
    network: { provider },
    setup: { systemCalls, components },
  } = dojo;

  // Add initialize function manually since it's not in the type definition
  const { contribute_to_construction, set_access, initialize_hyperstructure } = systemCalls;

  const [isLoading, setIsLoading] = useState<Loading>(Loading.None);
  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [resetContributions, setResetContributions] = useState(false);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const progresses = useHyperstructureProgress(entity.entity_id);
  const currentAmounts = useCurrentAmounts(entity.entity_id);

  const updates = useHyperstructureUpdates(entity.entity_id);

  const [newContributions, setNewContributions] = useState<Record<number, number>>({});

  const ownerName = getAddressNameFromEntity(entity.entity_id, components);

  const hyperstructure = useComponentValue(components.Hyperstructure, getEntityIdFromKeys([BigInt(entity.entity_id)]));

  const playerGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(account.address), dojo.setup.components),
    [],
  );

  // Get the AncientFragment balance of the hyperstructure entity
  const resourceManager = useMemo(() => {
    return new ResourceManager(components, entity.entity_id);
  }, [components, entity.entity_id]);

  const ancientFragmentBalance = useMemo(() => {
    // Convert bigint to number safely
    const balance = resourceManager.balance(ResourcesIds.AncientFragment);
    // Use toString and parseInt to safely convert bigint to number
    return Number(divideByPrecision(Number(balance.toString())));
  }, [resourceManager, updates]);

  // Calculate the progress percentage for AncientFragment
  const { ancientFragmentProgress, costNeeded } = useMemo(() => {
    const costNeeded = configManager.getHyperstructureConstructionCosts().amount;

    return {
      ancientFragmentProgress: Math.min(100, costNeeded ? (ancientFragmentBalance / costNeeded) * 100 : 0),
      costNeeded: costNeeded || 0,
    };
  }, [progresses, ancientFragmentBalance]);

  const canInitialize = useMemo(() => {
    return entity.isOwner && ancientFragmentProgress === 100 && hyperstructure && !hyperstructure.initialized;
  }, [entity.isOwner, ancientFragmentProgress, hyperstructure]);

  const initialize = async () => {
    setIsLoading(Loading.Initialize);

    try {
      await initialize_hyperstructure({
        signer: account,
        hyperstructure_id: entity.entity_id,
      });
    } catch (error) {
      console.error("Failed to initialize hyperstructure:", error);
    } finally {
      setIsLoading(Loading.None);
    }
  };

  const contributeToConstruction = async () => {
    const formattedContributions = Object.entries(newContributions).map(([resourceId, amount]) => ({
      resource: Number(resourceId),
      amount: multiplyByPrecision(amount),
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

  const canContribute = useMemo(() => {
    const hyperstructureOwnerGuild = getGuildFromPlayerAddress(BigInt(entity?.owner || 0), components);
    return (
      entity.isOwner ||
      (hyperstructure?.access === Access[Access.GuildOnly] &&
        playerGuild?.entityId !== undefined &&
        playerGuild.entityId !== 0n &&
        hyperstructureOwnerGuild?.entityId !== undefined &&
        hyperstructureOwnerGuild.entityId !== 0n &&
        hyperstructureOwnerGuild.entityId === playerGuild.entityId) ||
      hyperstructure?.access === Access[Access.Public]
    );
  }, [newContributions, structureEntityId]);

  // Function to get the specific reason why user can't contribute
  const getContributionRestrictionMessage = useMemo(() => {
    if (progresses.percentage === 100) {
      return null; // Construction is complete, no message needed
    }

    if (!hyperstructure?.initialized) {
      return {
        type: "warning",
        message: "Hyperstructure must be initialized before contributions can be made",
      };
    }

    if (!canContribute) {
      const hyperstructureOwnerGuild = getGuildFromPlayerAddress(BigInt(entity?.owner || 0), components);

      if (hyperstructure?.access === Access[Access.Private]) {
        return {
          type: "error",
          message: "This hyperstructure is private - only the owner can contribute",
        };
      }

      if (hyperstructure?.access === Access[Access.GuildOnly]) {
        if (!playerGuild?.entityId || playerGuild.entityId === 0n) {
          return {
            type: "error",
            message: "You must be in a tribe to contribute to this tribe-only hyperstructure",
          };
        }

        if (hyperstructureOwnerGuild?.entityId !== playerGuild.entityId) {
          return {
            type: "error",
            message: "This hyperstructure is tribe-only - you must be in the same tribe as the owner",
          };
        }
      }
    }

    return null;
  }, [canContribute, hyperstructure, progresses.percentage, entity?.owner, playerGuild, components]);

  const resourceElements = useMemo(() => {
    if (progresses.percentage === 100) return;

    const requiredAmounts = getHyperstructureTotalContributableAmounts(entity.entity_id, components);

    return Object.values(requiredAmounts)
      .sort((a, b) => {
        // Sort by rarity, so that the least rare resources are at the top
        const rarityA = RESOURCE_RARITY[a.resource] || Number.MAX_SAFE_INTEGER;
        const rarityB = RESOURCE_RARITY[b.resource] || Number.MAX_SAFE_INTEGER;
        return rarityA - rarityB;
      })
      .map(({ resource }) => {
        const currentAmount = currentAmounts.find((progress) => progress.resource === resource)?.amount || 0;
        const requiredAmount = requiredAmounts.find((progress) => progress.resource === resource)?.amount || 0;
        const progress = {
          percentage: currentAmount ? (currentAmount / requiredAmount) * 100 : 0,
          costNeeded: requiredAmount,
          hyperstructure_entity_id: entity.entity_id,
          resource_type: resource,
          amount: currentAmount,
        };

        return (
          <HyperstructureResourceChip
            structureEntityId={structureEntityId}
            setContributions={setNewContributions}
            contributions={newContributions}
            progress={progress}
            key={resource}
            resourceId={resource}
            resetContributions={resetContributions}
            disabled={!canContribute || !hyperstructure?.initialized}
          />
        );
      });
  }, [
    progresses,
    currentAmounts,
    newContributions,
    structureEntityId,
    canContribute,
    hyperstructure,
    resetContributions,
  ]);

  const myShares = useMemo(() => {
    return LeaderboardManager.instance(dojo.setup.components).getPlayerShares(
      ContractAddress(account.address),
      entity.entity_id,
    );
  }, [updates, structureEntityId]);

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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col p-2">
        <div className="flex">
          <div className="flex flex-col w-24 mr-4">
            <div className="text-xxs uppercase text-gold/80">Owner</div>
            <h5 className="text-sm truncate">{ownerName}</h5>
          </div>

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
                  <div className="flex justify-between items-center gap-1">
                    <h4 className="truncate">{entity.name}</h4>
                    <Button size="xs" onClick={() => {}}>
                      Reload
                    </Button>
                  </div>
                </div>

                {hyperstructure && (
                  <div className="flex flex-col gap-2">
                    <div
                      onMouseEnter={() => {
                        if (!hyperstructure.initialized) {
                          setTooltip({
                            content: <>Hyperstructure must be initialized first</>,
                            position: "right",
                          });
                        } else if (!entity.isOwner) {
                          setTooltip({
                            content: <>You are not the owner of the hyperstructure</>,
                            position: "right",
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setTooltip(null);
                      }}
                      className="relative group"
                    >
                      <Select
                        disabled={!hyperstructure.initialized || !entity.isOwner || isLoading === Loading.SetPrivate}
                        onValueChange={(access: keyof typeof Access) => {
                          if (!hyperstructure.initialized) return;
                          setAccess(BigInt(Access[access]));
                        }}
                        value={isLoading === Loading.SetPrivate ? "loading" : hyperstructure.access}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-sm border border-gold/20">
                          <SelectValue>
                            {isLoading === Loading.SetPrivate
                              ? "Loading..."
                              : DisplayedAccess[hyperstructure.access as keyof typeof DisplayedAccess]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 text-gold">
                          {Object.keys(Access)
                            .filter((access) => {
                              if (!isNaN(Number(access))) return false;

                              if (access === Access[Access.GuildOnly]) {
                                return playerGuild?.entityId !== undefined && playerGuild.entityId !== 0n;
                              }

                              return access !== hyperstructure!.access;
                            })
                            .map((access) => (
                              <SelectItem
                                key={access}
                                value={access}
                                disabled={!entity.isOwner || !hyperstructure.initialized}
                              >
                                {DisplayedAccess[access as keyof typeof DisplayedAccess]}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

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

      {/* Ancient Fragment Progress Bar */}
      {!hyperstructure?.initialized && (
        <div className="mt-2 mb-2 p-2 bg-gold/10 rounded">
          <div className="flex items-center justify-between mb-1">
            <h6 className="flex items-center">
              <ResourceIcon resource="Ancient Fragment" size="sm" className="mr-1" />
              <span className="text-sm font-medium">Ancient Fragment</span>
            </h6>
            <div className="flex items-center gap-2">
              <span className="text-sm">{currencyIntlFormat(ancientFragmentBalance)}</span>
              <span className="text-xs text-gold/70">/ {formatStringNumber(costNeeded, 0)} needed</span>
            </div>
          </div>
          <div
            className="relative w-full h-8 flex items-center px-2 text-xs"
            style={{
              backgroundImage:
                ancientFragmentProgress > 0
                  ? `linear-gradient(to right, #06D6A03c ${String(ancientFragmentProgress)}%, rgba(0,0,0,0) ${String(
                      ancientFragmentProgress,
                    )}%)`
                  : "",
            }}
          >
            <span>{currencyIntlFormat(ancientFragmentProgress)}%</span>
          </div>
          <div className="flex justify-end items-center mt-1">
            {canInitialize && (
              <Button
                size="xs"
                variant="primary"
                isLoading={isLoading === Loading.Initialize}
                disabled={isLoading !== Loading.None}
                onClick={initialize}
              >
                Initialize
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 w-full mb-1">
        <div className="flex justify-between px-3 items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Progress</div>
          <div className="font-bold text-sm">{currencyIntlFormat(progresses.percentage)}%</div>
        </div>
        <div className="flex justify-between px-3  items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Shares</div>
          <div className="font-bold text-sm">{currencyIntlFormat((myShares || 0) * 100)}%</div>
        </div>
        <div className="flex justify-between px-3 items-center p-1 text-center bg-gold/10 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-[10px]">Points/cycle</div>
          <div className="font-bold text-sm">
            {currencyIntlFormat((myShares || 0) * configManager.getHyperstructureConfig().pointsPerCycle)}
          </div>
        </div>
      </div>
      <div className="overflow-y-auto no-scrollbar h-[40vh] bg-gold/10">
        {progresses.percentage === 100 ? (
          <HyperstructureDetails hyperstructureEntityId={entity.entity_id} />
        ) : (
          <div className="relative">
            {getContributionRestrictionMessage && (
              <div
                className={`mx-2 mt-2 mb-3 p-3 rounded-lg border-l-4 ${
                  getContributionRestrictionMessage.type === "error" ? "border-gold text-gold" : "border-gold text-gold"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      getContributionRestrictionMessage.type === "error" ? "bg-red" : "bg-gold"
                    }`}
                  />
                  <span className="text-sm font-medium">{getContributionRestrictionMessage.message}</span>
                </div>
              </div>
            )}
            {resourceElements}
          </div>
        )}
      </div>
      {progresses.percentage !== 100 && (
        <div className="flex justify-end w-full mt-2">
          <div
            onMouseEnter={() => {
              if (!canContribute) {
                setTooltip({
                  content: <>Not the correct access</>,
                  position: "right",
                });
              } else if (!progresses.initialized) {
                setTooltip({
                  content: <>Hyperstructure must be initialized first</>,
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
              disabled={
                Object.keys(newContributions).length === 0 ||
                isLoading !== Loading.None ||
                !canContribute ||
                !progresses.initialized
              }
              onClick={contributeToConstruction}
            >
              Contribute To Construction
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
