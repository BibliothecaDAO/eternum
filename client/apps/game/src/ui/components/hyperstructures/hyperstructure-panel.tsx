import { useUIStore } from "@/hooks/store/use-ui-store";
import { HyperstructureDetails } from "@/ui/components/hyperstructures/hyperstructure-details";
import { HyperstructureResourceChip } from "@/ui/components/hyperstructures/hyperstructure-resource-chip";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import TextInput from "@/ui/elements/text-input";
import { currencyIntlFormat, formatStringNumber, getEntityIdFromKeys, separateCamelCase } from "@/ui/utils/utils";
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
import { Access, ContractAddress, MAX_NAME_LENGTH, ResourcesIds } from "@bibliothecadao/types";
import { useCurrentAmounts, useDojo, useHyperstructureProgress, useHyperstructureUpdates } from "@bibliothecadao/react";
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

  const resourceElements = useMemo(() => {
    if (progresses.percentage === 100) return;

    const requiredAmounts = getHyperstructureTotalContributableAmounts(entity.entity_id, components);

    return Object.values(requiredAmounts).map(({ resource }) => {
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
        />
      );
    });
  }, [progresses, currentAmounts, newContributions]);

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
  }, [newContributions]);

  const initialPoints = useMemo(() => {
    return LeaderboardManager.instance(dojo.setup.components).getCompletionPoints(
      ContractAddress(account.address),
      entity.entity_id,
    );
  }, [updates]);

  const myShares = useMemo(() => {
    return LeaderboardManager.instance(dojo.setup.components).getPlayerShares(
      ContractAddress(account.address),
      entity.entity_id,
    );
  }, [updates]);

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
      <div className="flex flex-col p-2">
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
                    <Button size="xs" onClick={() => {}}>
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
                        <SelectTrigger className="w-[140px] h-8 text-sm border border-gold/20">
                          <SelectValue
                            placeholder={DisplayedAccess[hyperstructure.access as keyof typeof DisplayedAccess]}
                          />
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
                              <SelectItem key={access} value={access} disabled={!entity.isOwner}>
                                {separateCamelCase(access)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm">Loading...</div>
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
      <div className="overflow-y-auto no-scrollbar h-[40vh] bg-gold/10  p-2">
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
          </div>
        )}
      </div>
    </div>
  );
};
