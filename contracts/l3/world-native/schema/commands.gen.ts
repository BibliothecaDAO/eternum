// Generated from command routes and production payload ABIs. Run the native schema generator to update.
import type { BigNumberish } from "starknet";
export const nativeCommandBits = {
  "BuySeal": "18889465931478580854784",
  "BuyStamina": "37778931862957161709568",
  "ChooseOath": "9444732965739290427392",
  "RerollOath": "75557863725914323419136",
  "ClaimDailyQuest": "4722366482869645213696",
  "CreateExplorer": "1",
  "Explore": "2",
  "Battle": "4",
  "Move": "8",
  "ToggleAlternate": "16",
  "LevelUp": "64",
  "ProvisionRealm": "256",
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
  "BattleGuard": "536870912",
  "ApplyRelic": "8796093022208",
  "CreateGuild": "9007199254740992",
  "JoinGuild": "18014398509481984",
  "LeaveGuild": "36028797018963968",
  "SetGuildWhitelist": "72057594037927936",
  "RemoveGuildMember": "144115188075855872",
  "MarkGameSettled": "288230376151711744",
  "ManageTroops": "576460752303423488",
  "GuardAttack": "1152921504606846976",
  "ProvisionAndUpgradeRealm": "18446744073709551616",
  "SetEntityName": "36893488147419103232",
  "EnterDepth": "73786976294838206464",
  "Research": "147573952589676412928",
  "InteractSite": "590295810358705651712",
  "SetRealmSkin": "604462909807314587353088"
} as const;
export const nativeBlitzCommandBits = {
  "SeatBlitzRoster": "151115727451828646838272",
  "RaiseHyperstructure": "302231454903657293676544"
} as const;
export const nativeFrontierOnlyCommandBits = {
  "SetRealmSkin": "604462909807314587353088"
} as const;
export const nativeGamesWrites = [
  "authority_call",
  "deliver_deposit",
  "set_ledger_operator",
  "sweep_lords",
  "grant_seal",
  "credit_fragments",
  "register_entitlement",
  "register_release",
  "open_release",
  "apply_release",
  "set_launcher",
  "play",
  "create_game",
  "initialize_realm_traits",
  "register_village_pass"
] as const;
export interface NativeCommandPayloads {
  BuySeal: undefined;
  BuyStamina: { readonly explorer_id: BigNumberish; readonly fragments: BigNumberish };
  ChooseOath: { readonly explorer_id: BigNumberish; readonly expected_pick: BigNumberish; readonly oath: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined }; readonly replace: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined } };
  RerollOath: { readonly explorer_id: BigNumberish; readonly expected_pick: BigNumberish; readonly index: BigNumberish };
  ClaimDailyQuest: { readonly home: BigNumberish; readonly day: BigNumberish };
  CreateExplorer: { readonly slot: BigNumberish; readonly structure_id: BigNumberish; readonly category: BigNumberish; readonly tier: BigNumberish; readonly amount: BigNumberish; readonly direction: BigNumberish };
  Explore: { readonly explorer_id: BigNumberish; readonly direction: BigNumberish };
  Battle: { readonly attacker_id: BigNumberish; readonly defender_id: BigNumberish; readonly steal_resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  Move: { readonly explorer_id: BigNumberish; readonly directions: readonly (BigNumberish)[] };
  ToggleAlternate: { readonly explorer_id: BigNumberish; readonly spire_direction: BigNumberish };
  LevelUp: BigNumberish;
  ProvisionRealm: BigNumberish;
  SettleSeason: { readonly selected_realm: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined }; readonly order: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined } };
  SettleVillage: { readonly pass_id: BigNumberish; readonly connected_realm_entity_id: BigNumberish };
  ReceiveVillageArmy: BigNumberish;
  BurnStructureResources: { readonly entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  TransferExplorerResources: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  OffloadArrival: { readonly entity_id: BigNumberish; readonly day: BigNumberish; readonly slot: BigNumberish; readonly resource_count: BigNumberish };
  SendResources: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  TransferExplorerResourcesToStructure: { readonly from_entity_id: BigNumberish; readonly to_entity_id: BigNumberish; readonly resources: readonly ({ readonly resource_type: BigNumberish; readonly amount: BigNumberish })[] };
  BurnResourceForResourceProduction: { readonly structure_id: BigNumberish; readonly resource_types: readonly (BigNumberish)[]; readonly amounts: readonly (BigNumberish)[] };
  CreateBuilding: { readonly structure_id: BigNumberish; readonly directions: readonly (BigNumberish)[]; readonly category: BigNumberish; readonly use_simple: boolean };
  DestroyBuilding: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  PauseBuildingProduction: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  ResumeBuildingProduction: { readonly structure_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  BattleGuard: { readonly attacker_id: BigNumberish; readonly defender_id: BigNumberish };
  ApplyRelic: { readonly entity_id: BigNumberish; readonly kind: { readonly kind: "Blade"; readonly value: undefined } | { readonly kind: "Ward"; readonly value: undefined } | { readonly kind: "Plunder"; readonly value: undefined } | { readonly kind: "StaminaRegen"; readonly value: undefined } | { readonly kind: "Antidote"; readonly value: undefined }; readonly expected_rank: BigNumberish };
  CreateGuild: { readonly owned_structure_id: BigNumberish; readonly public: boolean; readonly name: BigNumberish };
  JoinGuild: { readonly owned_structure_id: BigNumberish; readonly guild_id: BigNumberish };
  LeaveGuild: undefined;
  SetGuildWhitelist: { readonly player: BigNumberish; readonly owned_structure_id: BigNumberish; readonly allowed: boolean };
  RemoveGuildMember: BigNumberish;
  MarkGameSettled: undefined;
  ManageTroops: { readonly kind: "RecruitGuard"; readonly value: { readonly guard: { readonly structure_id: BigNumberish; readonly slot: BigNumberish }; readonly category: { readonly kind: "Knight"; readonly value: undefined } | { readonly kind: "Paladin"; readonly value: undefined } | { readonly kind: "Crossbowman"; readonly value: undefined }; readonly tier: { readonly kind: "T1"; readonly value: undefined } | { readonly kind: "T2"; readonly value: undefined } | { readonly kind: "T3"; readonly value: undefined }; readonly amount: BigNumberish } } | { readonly kind: "RemoveGuard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } } | { readonly kind: "RecruitExplorer"; readonly value: { readonly explorer_id: BigNumberish; readonly amount: BigNumberish; readonly supply_post: { readonly kind: "Some"; readonly value: BigNumberish } | { readonly kind: "None"; readonly value: undefined } } } | { readonly kind: "RemoveExplorer"; readonly value: BigNumberish } | { readonly kind: "Transfer"; readonly value: { readonly source: { readonly kind: "Explorer"; readonly value: BigNumberish } | { readonly kind: "Guard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } }; readonly target: { readonly kind: "Explorer"; readonly value: BigNumberish } | { readonly kind: "Guard"; readonly value: { readonly structure_id: BigNumberish; readonly slot: BigNumberish } }; readonly amount: BigNumberish } };
  GuardAttack: { readonly guard: { readonly structure_id: BigNumberish; readonly slot: BigNumberish }; readonly explorer_id: BigNumberish };
  ProvisionAndUpgradeRealm: BigNumberish;
  SetEntityName: { readonly entity_id: BigNumberish; readonly name: BigNumberish };
  EnterDepth: { readonly explorer_id: BigNumberish; readonly depth: BigNumberish };
  Research: { readonly structure_id: BigNumberish; readonly row: BigNumberish };
  InteractSite: { readonly explorer_id: BigNumberish; readonly coord: { readonly alt: boolean; readonly x: BigNumberish; readonly y: BigNumberish } };
  SetRealmSkin: { readonly entity_id: BigNumberish; readonly family: BigNumberish };
}
export type NativeCommand = { [K in keyof NativeCommandPayloads]: { kind: K; value: NativeCommandPayloads[K] } }[keyof NativeCommandPayloads];
