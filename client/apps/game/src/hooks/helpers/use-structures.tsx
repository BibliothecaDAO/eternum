import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/dojo-context";
import { useGetArmyByEntityId } from "@/hooks/helpers/use-armies";
import useNextBlockTimestamp from "@/hooks/use-next-block-timestamp";
import { currentTickCount } from "@/ui/utils/utils";
import { getEntityName } from "@/utils/entities";
import {
  BattleManager,
  ContractAddress,
  ID,
  Position,
  Structure,
  StructureType,
  TickIds,
} from "@bibliothecadao/eternum";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";

export const useStructureAtPosition = ({ x, y }: Position): Structure | undefined => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Position, Structure, EntityOwner, Owner, Protector, AddressName } = components;

  const { getArmy } = useGetArmyByEntityId();

  const structure = useMemo(() => {
    const structureAtPosition = runQuery([HasValue(Position, { x, y }), Has(Structure)]);
    const structureEntityId = Array.from(structureAtPosition)[0];
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getArmy(protectorArmy.army_id) : undefined;

    const name = getEntityName(structure.entity_id, components) || "";

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([owner?.address]));
    const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      ownerName,
      protector,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
    };
  }, [x, y]);

  return structure;
};

export const useStructureByPosition = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const { Position, Structure, EntityOwner, Owner, Protector } = components;

  const { getArmy } = useGetArmyByEntityId();

  const structureAtPosition = ({ x, y }: Position) => {
    const structureAtPosition = runQuery([HasValue(Position, { x, y }), Has(Structure)]);
    const structureEntityId = Array.from(structureAtPosition)[0];
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getArmy(protectorArmy.army_id) : undefined;

    const name = getEntityName(structure.entity_id, components);

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      protector,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
    };
  };

  return structureAtPosition;
};

export const useStructureByEntityId = (entityId: ID) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure, EntityOwner, Owner, Protector, Position, AddressName } = components;

  const { getArmy } = useGetArmyByEntityId();

  const structure = useMemo(() => {
    const structureEntityId = getEntityIdFromKeys([BigInt(entityId)]);
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getArmy(protectorArmy.army_id) : undefined;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([owner?.address]));
    const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

    const name = getEntityName(entityId, components);

    const position = getComponentValue(Position, structureEntityId);

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      position,
      protector,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
      ownerName,
    };
  }, [entityId]);

  return structure;
};

export const useStructures = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure, EntityOwner, Owner, Protector, Position, AddressName } = components;

  const { getArmy } = useGetArmyByEntityId();

  const getStructureByEntityId = (entityId: ID) => {
    const structureEntityId = getEntityIdFromKeys([BigInt(entityId)]);
    const structure = getComponentValue(Structure, structureEntityId);
    if (!structure) return;

    const entityOwner = getComponentValue(EntityOwner, structureEntityId);
    if (!entityOwner) return;

    const ownerOnChain = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

    const protectorArmy = getComponentValue(Protector, structureEntityId);
    const protector = protectorArmy ? getArmy(protectorArmy.army_id) : undefined;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([owner?.address]));
    const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

    const name = getEntityName(entityId, components);

    const position = getComponentValue(Position, structureEntityId);

    return {
      ...structure,
      entityOwner,
      owner,
      name,
      position,
      protector,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isMercenary: owner.address === 0n,
      ownerName,
    };
  };

  return { getStructureByEntityId };
};

export const useIsStructureImmune = (
  structure: { category: string; created_at: bigint } | undefined,
  currentTimestamp: number,
): boolean => {
  const structureType = StructureType[(structure?.category as keyof typeof StructureType) || 0];

  const tickCount = currentTickCount(currentTimestamp);
  const allowAttackTick =
    currentTickCount(Number(structure?.created_at || 0)) + configManager.getBattleGraceTickCount(structureType);

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};

export const useStructureImmunityTimer = (structure: Structure | undefined, nextBlockTimestamp: number) => {
  const structureType = StructureType[(structure?.category as keyof typeof StructureType) || 0];

  const immunityEndTimestamp = useMemo(() => {
    return (
      Number(structure?.created_at || 0) +
      (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0)
    );
  }, [structure?.created_at, structure?.category]);

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp!;
  }, [immunityEndTimestamp, nextBlockTimestamp]);

  return timer;
};

export const useIsResourcesLocked = (structureEntityId: ID) => {
  const dojo = useDojo();
  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const { getStructureByEntityId } = useStructures();
  const structure = getStructureByEntityId(structureEntityId);

  return useMemo(() => {
    const battleManager = new BattleManager(
      dojo.setup.components,
      dojo.network.provider,
      structure?.protector?.battle_id || 0,
    );
    return battleManager.isResourcesLocked(nextBlockTimestamp!);
  }, [structure, nextBlockTimestamp]);
};
