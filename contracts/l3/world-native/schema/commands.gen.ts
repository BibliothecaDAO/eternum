// Generated from command routes and production payload ABIs. Run the native schema generator to update.
import type { BigNumberish } from "starknet";
export const nativeCommandBits = {
  "CreateExplorer": "1",
  "Explore": "2",
  "Battle": "4",
  "Move": "8",
  "ToggleAlternate": "16",
  "LevelUp": "64",
  "SettleBlitzRoster": "128",
  "ProvisionRealm": "256",
  "CreateReservedHyperstructure": "512",
  "SettleSeason": "1024",
  "SettleVillage": "2048",
  "ReceiveVillageArmy": "4096",
  "BurnStructureResources": "8192",
  "TransferExplorerResources": "16384",
  "OffloadArrival": "65536",
  "SendResources": "131072",
  "TransferExplorerResourcesToStructure": "262144",
  "BurnResourceForResourceProduction": "1048576",
  "CreateBuilding": "2097152",
  "DestroyBuilding": "4194304",
  "PauseBuildingProduction": "8388608",
  "ResumeBuildingProduction": "16777216",
  "ContributeBitcoinLabor": "33554432",
  "CloseBitcoinPhase": "67108864",
  "BindBitcoinPhase": "134217728",
  "ClaimBitcoinPhase": "268435456",
  "BattleGuard": "536870912",
  "InitializeHyperstructure": "274877906944",
  "ContributeHyperstructure": "549755813888",
  "AllocateHyperstructureShares": "1099511627776",
  "SetConstructionAccess": "2199023255552",
  "OpenRelicChest": "4398046511104",
  "ApplyRelic": "8796093022208",
  "CloseSeason": "17592186044416",
  "RecordBlitzResults": "2251799813685248",
  "CraftRelic": "4503599627370496",
  "CreateGuild": "9007199254740992",
  "JoinGuild": "18014398509481984",
  "LeaveGuild": "36028797018963968",
  "SetGuildWhitelist": "72057594037927936",
  "RemoveGuildMember": "144115188075855872",
  "MarkGameSettled": "288230376151711744",
  "ManageTroops": "576460752303423488",
  "GuardAttack": "1152921504606846976",
  "DepositResource": "4611686018427387904",
  "WithdrawResource": "9223372036854775808",
  "ProvisionAndUpgradeRealm": "18446744073709551616",
  "SetEntityName": "36893488147419103232",
  "EnterDepth": "73786976294838206464",
  "Research": "147573952589676412928",
  "SpendSkillPoint": "295147905179352825856",
  "InteractSite": "590295810358705651712"
} as const;
export interface NativeCommandPayloads {
  CreateExplorer: { readonly slot: BigNumberish; readonly structure_id: BigNumberish; readonly category: BigNumberish; readonly tier: BigNumberish; readonly amount: BigNumberish; readonly direction: BigNumberish };
  Explore: { readonly explorer_id: BigNumberish; readonly direction: BigNumberish };
  Battle: { readonly attacker_id: BigNumberish; readonly defender_id: BigNumberish; readonly steal_resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  Move: { readonly explorer_id: BigNumberish; readonly directions: readonly (BigNumberish)[] };
  ToggleAlternate: { readonly explorer_id: BigNumberish; readonly spire_direction: BigNumberish };
  LevelUp: BigNumberish;
  SettleBlitzRoster: undefined;
  ProvisionRealm: BigNumberish;
  CreateReservedHyperstructure: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish };
  SettleSeason: { readonly selected_realm: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined }; readonly aspect: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined } };
  SettleVillage: { readonly pass_id: BigNumberish; readonly connected_realm_entity_id: BigNumberish };
  ReceiveVillageArmy: BigNumberish;
  BurnStructureResources: { readonly entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  TransferExplorerResources: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  OffloadArrival: { readonly entity_id: BigNumberish; readonly day: BigNumberish; readonly slot: BigNumberish; readonly resource_count: BigNumberish };
  SendResources: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  TransferExplorerResourcesToStructure: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  BurnResourceForResourceProduction: { readonly structure_id: BigNumberish; readonly resource_types: readonly (BigNumberish)[]; readonly amounts: readonly (BigNumberish)[] };
  CreateBuilding: { readonly structure_id: BigNumberish; readonly directions: readonly (BigNumberish)[]; readonly category: BigNumberish; readonly use_simple: boolean; readonly scouting_kind: BigNumberish };
  DestroyBuilding: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  PauseBuildingProduction: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  ResumeBuildingProduction: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  ContributeBitcoinLabor: { readonly structure_id: BigNumberish; readonly amount: BigNumberish };
  CloseBitcoinPhase: BigNumberish;
  BindBitcoinPhase: BigNumberish;
  ClaimBitcoinPhase: { readonly phase: BigNumberish; readonly mine_ids: readonly (BigNumberish)[] };
  BattleGuard: { readonly attacker_id: BigNumberish; readonly defender_id: BigNumberish; readonly relic_slot: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined } };
  InitializeHyperstructure: BigNumberish;
  ContributeHyperstructure: { readonly hyperstructure_id: BigNumberish; readonly from_structure_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  AllocateHyperstructureShares: { readonly hyperstructure_id: BigNumberish; readonly shareholders: readonly ({ readonly player: BigNumberish; readonly bps: BigNumberish })[] };
  SetConstructionAccess: { readonly hyperstructure_id: BigNumberish; readonly access: { readonly kind: "Public"; readonly value: undefined } | { readonly kind: "Private"; readonly value: undefined } | { readonly kind: "GuildOnly"; readonly value: undefined } };
  OpenRelicChest: { readonly explorer_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  ApplyRelic: { readonly entity_id: BigNumberish; readonly relic_id: BigNumberish; readonly recipient: { readonly kind: "Explorer"; readonly value: undefined } | { readonly kind: "StructureProduction"; readonly value: undefined } | { readonly kind: "StructureGuard"; readonly value: undefined } | { readonly kind: "ArmySlot"; readonly value: BigNumberish } };
  CloseSeason: undefined;
  RecordBlitzResults: undefined;
  CraftRelic: BigNumberish;
  CreateGuild: { readonly owned_structure_id: BigNumberish; readonly public: boolean; readonly name: BigNumberish };
  JoinGuild: { readonly owned_structure_id: BigNumberish; readonly guild_id: BigNumberish };
  LeaveGuild: undefined;
  SetGuildWhitelist: { readonly player: BigNumberish; readonly owned_structure_id: BigNumberish; readonly allowed: boolean };
  RemoveGuildMember: BigNumberish;
  MarkGameSettled: undefined;
  ManageTroops: { readonly kind: "RecruitGuard"; readonly value: { readonly guard: { readonly structure_id: BigNumberish; readonly slot: BigNumberish }; readonly category: { readonly kind: "Knight"; readonly value: undefined } | { readonly kind: "Paladin"; readonly value: undefined } | { readonly kind: "Crossbowman"; readonly value: undefined }; readonly tier: { readonly kind: "T1"; readonly value: undefined } | { readonly kind: "T2"; readonly value: undefined } | { readonly kind: "T3"; readonly value: undefined }; readonly amount: BigNumberish } } | { readonly kind: "RemoveGuard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } } | { readonly kind: "RecruitExplorer"; readonly value: { readonly explorer_id: BigNumberish; readonly amount: BigNumberish } } | { readonly kind: "RemoveExplorer"; readonly value: BigNumberish } | { readonly kind: "Transfer"; readonly value: { readonly source: { readonly kind: "Explorer"; readonly value: BigNumberish } | { readonly kind: "Guard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } }; readonly target: { readonly kind: "Explorer"; readonly value: BigNumberish } | { readonly kind: "Guard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } }; readonly amount: BigNumberish } };
  GuardAttack: { readonly guard: { readonly structure_id: BigNumberish; readonly slot: BigNumberish }; readonly explorer_id: BigNumberish };
  DepositResource: { readonly structure_id: BigNumberish; readonly resource_type: BigNumberish; readonly amount: BigNumberish; readonly client_fee_recipient: BigNumberish };
  WithdrawResource: { readonly structure_id: BigNumberish; readonly recipient: BigNumberish; readonly resource_type: BigNumberish; readonly amount: BigNumberish; readonly client_fee_recipient: BigNumberish };
  ProvisionAndUpgradeRealm: BigNumberish;
  SetEntityName: { readonly entity_id: BigNumberish; readonly name: BigNumberish };
  EnterDepth: { readonly explorer_id: BigNumberish; readonly depth: BigNumberish };
  Research: { readonly structure_id: BigNumberish; readonly row: BigNumberish; readonly choice: BigNumberish };
  SpendSkillPoint: { readonly explorer_id: BigNumberish; readonly choice: { readonly kind: "Battle"; readonly value: undefined } | { readonly kind: "Logistics"; readonly value: undefined } | { readonly kind: "Scouting"; readonly value: { readonly kind: "Camp"; readonly value: undefined } | { readonly kind: "Rift"; readonly value: undefined } | { readonly kind: "Sanctuaries"; readonly value: undefined } } | { readonly kind: "Homecoming"; readonly value: undefined } | { readonly kind: "Stamina"; readonly value: BigNumberish } };
  InteractSite: { readonly explorer_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
}
export type NativeCommand = { [K in keyof NativeCommandPayloads]: { kind: K; value: NativeCommandPayloads[K] } }[keyof NativeCommandPayloads];
