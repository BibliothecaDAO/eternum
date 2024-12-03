/* eslint-disable */
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  ContractAddress: { input: any; output: any; }
  Cursor: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  Enum: { input: any; output: any; }
  bool: { input: any; output: any; }
  felt252: { input: any; output: any; }
  u8: { input: any; output: any; }
  u16: { input: any; output: any; }
  u32: { input: any; output: any; }
  u64: { input: any; output: any; }
  u128: { input: any; output: any; }
  u256: { input: any; output: any; }
};

export enum OrderDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type World__ModelOrder = {
  direction: OrderDirection;
  field: World__ModelOrderField;
};

export enum World__ModelOrderField {
  ClassHash = 'CLASS_HASH',
  Name = 'NAME'
}

export type Darkshuffle_BattleEffectsOrder = {
  direction: OrderDirection;
  field: Darkshuffle_BattleEffectsOrderField;
};

export enum Darkshuffle_BattleEffectsOrderField {
  BattleId = 'BATTLE_ID',
  EnemyMarks = 'ENEMY_MARKS',
  HeroDmgReduction = 'HERO_DMG_REDUCTION',
  NextBruteAttackBonus = 'NEXT_BRUTE_ATTACK_BONUS',
  NextBruteHealthBonus = 'NEXT_BRUTE_HEALTH_BONUS',
  NextHunterAttackBonus = 'NEXT_HUNTER_ATTACK_BONUS',
  NextHunterHealthBonus = 'NEXT_HUNTER_HEALTH_BONUS'
}

export type Darkshuffle_BattleEffectsWhereInput = {
  battle_id?: InputMaybe<Scalars['u32']['input']>;
  battle_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  enemy_marks?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksEQ?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksGT?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksGTE?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  enemy_marksLIKE?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksLT?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksLTE?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksNEQ?: InputMaybe<Scalars['u8']['input']>;
  enemy_marksNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  enemy_marksNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reduction?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionGT?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionGTE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_dmg_reductionLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionLT?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionLTE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionNEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_dmg_reductionNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonus?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusEQ?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusGT?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusGTE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_brute_attack_bonusLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusLT?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusLTE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusNEQ?: InputMaybe<Scalars['u8']['input']>;
  next_brute_attack_bonusNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_brute_attack_bonusNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonus?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusEQ?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusGT?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusGTE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_brute_health_bonusLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusLT?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusLTE?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusNEQ?: InputMaybe<Scalars['u8']['input']>;
  next_brute_health_bonusNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_brute_health_bonusNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonus?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusEQ?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusGT?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusGTE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_hunter_attack_bonusLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusLT?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusLTE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusNEQ?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_attack_bonusNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_hunter_attack_bonusNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonus?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusEQ?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusGT?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusGTE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_hunter_health_bonusLIKE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusLT?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusLTE?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusNEQ?: InputMaybe<Scalars['u8']['input']>;
  next_hunter_health_bonusNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  next_hunter_health_bonusNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type Darkshuffle_BattleOrder = {
  direction: OrderDirection;
  field: Darkshuffle_BattleOrderField;
};

export enum Darkshuffle_BattleOrderField {
  BattleId = 'BATTLE_ID',
  Deck = 'DECK',
  DeckIndex = 'DECK_INDEX',
  GameId = 'GAME_ID',
  Hand = 'HAND',
  HeroEnergy = 'HERO_ENERGY',
  HeroHealth = 'HERO_HEALTH',
  MonsterAttack = 'MONSTER_ATTACK',
  MonsterHealth = 'MONSTER_HEALTH',
  MonsterId = 'MONSTER_ID',
  MonsterType = 'MONSTER_TYPE',
  Round = 'ROUND'
}

export type Darkshuffle_BattleWhereInput = {
  battle_id?: InputMaybe<Scalars['u32']['input']>;
  battle_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  deck_index?: InputMaybe<Scalars['u8']['input']>;
  deck_indexEQ?: InputMaybe<Scalars['u8']['input']>;
  deck_indexGT?: InputMaybe<Scalars['u8']['input']>;
  deck_indexGTE?: InputMaybe<Scalars['u8']['input']>;
  deck_indexIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  deck_indexLIKE?: InputMaybe<Scalars['u8']['input']>;
  deck_indexLT?: InputMaybe<Scalars['u8']['input']>;
  deck_indexLTE?: InputMaybe<Scalars['u8']['input']>;
  deck_indexNEQ?: InputMaybe<Scalars['u8']['input']>;
  deck_indexNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  deck_indexNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  game_id?: InputMaybe<Scalars['u32']['input']>;
  game_idEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idGT?: InputMaybe<Scalars['u32']['input']>;
  game_idGTE?: InputMaybe<Scalars['u32']['input']>;
  game_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_idLT?: InputMaybe<Scalars['u32']['input']>;
  game_idLTE?: InputMaybe<Scalars['u32']['input']>;
  game_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hero_energy?: InputMaybe<Scalars['u8']['input']>;
  hero_energyEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_energyGT?: InputMaybe<Scalars['u8']['input']>;
  hero_energyGTE?: InputMaybe<Scalars['u8']['input']>;
  hero_energyIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_energyLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_energyLT?: InputMaybe<Scalars['u8']['input']>;
  hero_energyLTE?: InputMaybe<Scalars['u8']['input']>;
  hero_energyNEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_energyNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_energyNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_health?: InputMaybe<Scalars['u8']['input']>;
  hero_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_healthGT?: InputMaybe<Scalars['u8']['input']>;
  hero_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthLT?: InputMaybe<Scalars['u8']['input']>;
  hero_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_attack?: InputMaybe<Scalars['u8']['input']>;
  monster_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_attackGT?: InputMaybe<Scalars['u8']['input']>;
  monster_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  monster_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_attackLT?: InputMaybe<Scalars['u8']['input']>;
  monster_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  monster_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_health?: InputMaybe<Scalars['u8']['input']>;
  monster_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_healthGT?: InputMaybe<Scalars['u8']['input']>;
  monster_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  monster_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_healthLT?: InputMaybe<Scalars['u8']['input']>;
  monster_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  monster_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_id?: InputMaybe<Scalars['u8']['input']>;
  monster_idEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_idGT?: InputMaybe<Scalars['u8']['input']>;
  monster_idGTE?: InputMaybe<Scalars['u8']['input']>;
  monster_idIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_idLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_idLT?: InputMaybe<Scalars['u8']['input']>;
  monster_idLTE?: InputMaybe<Scalars['u8']['input']>;
  monster_idNEQ?: InputMaybe<Scalars['u8']['input']>;
  monster_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  monster_idNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  monster_type?: InputMaybe<Scalars['Enum']['input']>;
  round?: InputMaybe<Scalars['u8']['input']>;
  roundEQ?: InputMaybe<Scalars['u8']['input']>;
  roundGT?: InputMaybe<Scalars['u8']['input']>;
  roundGTE?: InputMaybe<Scalars['u8']['input']>;
  roundIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  roundLIKE?: InputMaybe<Scalars['u8']['input']>;
  roundLT?: InputMaybe<Scalars['u8']['input']>;
  roundLTE?: InputMaybe<Scalars['u8']['input']>;
  roundNEQ?: InputMaybe<Scalars['u8']['input']>;
  roundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  roundNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type Darkshuffle_BoardOrder = {
  direction: OrderDirection;
  field: Darkshuffle_BoardOrderField;
};

export enum Darkshuffle_BoardOrderField {
  BattleId = 'BATTLE_ID',
  Creature1 = 'CREATURE1',
  Creature2 = 'CREATURE2',
  Creature3 = 'CREATURE3',
  Creature4 = 'CREATURE4',
  Creature5 = 'CREATURE5',
  Creature6 = 'CREATURE6'
}

export type Darkshuffle_BoardWhereInput = {
  battle_id?: InputMaybe<Scalars['u32']['input']>;
  battle_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type Darkshuffle_DonationOrder = {
  direction: OrderDirection;
  field: Darkshuffle_DonationOrderField;
};

export enum Darkshuffle_DonationOrderField {
  Address = 'ADDRESS',
  Amount = 'AMOUNT',
  Name = 'NAME',
  SeasonId = 'SEASON_ID',
  Social = 'SOCIAL'
}

export type Darkshuffle_DonationWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  amount?: InputMaybe<Scalars['u256']['input']>;
  amountEQ?: InputMaybe<Scalars['u256']['input']>;
  amountGT?: InputMaybe<Scalars['u256']['input']>;
  amountGTE?: InputMaybe<Scalars['u256']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u256']['input']>;
  amountLT?: InputMaybe<Scalars['u256']['input']>;
  amountLTE?: InputMaybe<Scalars['u256']['input']>;
  amountNEQ?: InputMaybe<Scalars['u256']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
  name?: InputMaybe<Scalars['felt252']['input']>;
  nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  nameGT?: InputMaybe<Scalars['felt252']['input']>;
  nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  nameLT?: InputMaybe<Scalars['felt252']['input']>;
  nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  season_id?: InputMaybe<Scalars['u32']['input']>;
  season_idEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idGT?: InputMaybe<Scalars['u32']['input']>;
  season_idGTE?: InputMaybe<Scalars['u32']['input']>;
  season_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  season_idLT?: InputMaybe<Scalars['u32']['input']>;
  season_idLTE?: InputMaybe<Scalars['u32']['input']>;
  season_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  social?: InputMaybe<Scalars['felt252']['input']>;
  socialEQ?: InputMaybe<Scalars['felt252']['input']>;
  socialGT?: InputMaybe<Scalars['felt252']['input']>;
  socialGTE?: InputMaybe<Scalars['felt252']['input']>;
  socialIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  socialLIKE?: InputMaybe<Scalars['felt252']['input']>;
  socialLT?: InputMaybe<Scalars['felt252']['input']>;
  socialLTE?: InputMaybe<Scalars['felt252']['input']>;
  socialNEQ?: InputMaybe<Scalars['felt252']['input']>;
  socialNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  socialNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
};

export type Darkshuffle_DraftOrder = {
  direction: OrderDirection;
  field: Darkshuffle_DraftOrderField;
};

export enum Darkshuffle_DraftOrderField {
  Cards = 'CARDS',
  GameId = 'GAME_ID',
  Options = 'OPTIONS'
}

export type Darkshuffle_DraftWhereInput = {
  game_id?: InputMaybe<Scalars['u32']['input']>;
  game_idEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idGT?: InputMaybe<Scalars['u32']['input']>;
  game_idGTE?: InputMaybe<Scalars['u32']['input']>;
  game_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_idLT?: InputMaybe<Scalars['u32']['input']>;
  game_idLTE?: InputMaybe<Scalars['u32']['input']>;
  game_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type Darkshuffle_GameEffectsOrder = {
  direction: OrderDirection;
  field: Darkshuffle_GameEffectsOrderField;
};

export enum Darkshuffle_GameEffectsOrderField {
  AllAttack = 'ALL_ATTACK',
  BruteAttack = 'BRUTE_ATTACK',
  BruteHealth = 'BRUTE_HEALTH',
  CardDraw = 'CARD_DRAW',
  FirstAttack = 'FIRST_ATTACK',
  FirstCost = 'FIRST_COST',
  FirstHealth = 'FIRST_HEALTH',
  GameId = 'GAME_ID',
  HeroCardHeal = 'HERO_CARD_HEAL',
  HeroDmgReduction = 'HERO_DMG_REDUCTION',
  HunterAttack = 'HUNTER_ATTACK',
  HunterHealth = 'HUNTER_HEALTH',
  MagicalAttack = 'MAGICAL_ATTACK',
  MagicalHealth = 'MAGICAL_HEALTH',
  PlayCreatureHeal = 'PLAY_CREATURE_HEAL',
  StartBonusEnergy = 'START_BONUS_ENERGY'
}

export type Darkshuffle_GameEffectsWhereInput = {
  all_attack?: InputMaybe<Scalars['u8']['input']>;
  all_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  all_attackGT?: InputMaybe<Scalars['u8']['input']>;
  all_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  all_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  all_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  all_attackLT?: InputMaybe<Scalars['u8']['input']>;
  all_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  all_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  all_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  all_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  brute_attack?: InputMaybe<Scalars['u8']['input']>;
  brute_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  brute_attackGT?: InputMaybe<Scalars['u8']['input']>;
  brute_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  brute_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  brute_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  brute_attackLT?: InputMaybe<Scalars['u8']['input']>;
  brute_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  brute_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  brute_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  brute_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  brute_health?: InputMaybe<Scalars['u8']['input']>;
  brute_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  brute_healthGT?: InputMaybe<Scalars['u8']['input']>;
  brute_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  brute_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  brute_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  brute_healthLT?: InputMaybe<Scalars['u8']['input']>;
  brute_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  brute_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  brute_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  brute_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  card_draw?: InputMaybe<Scalars['u8']['input']>;
  card_drawEQ?: InputMaybe<Scalars['u8']['input']>;
  card_drawGT?: InputMaybe<Scalars['u8']['input']>;
  card_drawGTE?: InputMaybe<Scalars['u8']['input']>;
  card_drawIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  card_drawLIKE?: InputMaybe<Scalars['u8']['input']>;
  card_drawLT?: InputMaybe<Scalars['u8']['input']>;
  card_drawLTE?: InputMaybe<Scalars['u8']['input']>;
  card_drawNEQ?: InputMaybe<Scalars['u8']['input']>;
  card_drawNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  card_drawNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_attack?: InputMaybe<Scalars['u8']['input']>;
  first_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  first_attackGT?: InputMaybe<Scalars['u8']['input']>;
  first_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  first_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_attackLT?: InputMaybe<Scalars['u8']['input']>;
  first_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  first_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  first_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_cost?: InputMaybe<Scalars['u8']['input']>;
  first_costEQ?: InputMaybe<Scalars['u8']['input']>;
  first_costGT?: InputMaybe<Scalars['u8']['input']>;
  first_costGTE?: InputMaybe<Scalars['u8']['input']>;
  first_costIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_costLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_costLT?: InputMaybe<Scalars['u8']['input']>;
  first_costLTE?: InputMaybe<Scalars['u8']['input']>;
  first_costNEQ?: InputMaybe<Scalars['u8']['input']>;
  first_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_costNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_health?: InputMaybe<Scalars['u8']['input']>;
  first_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  first_healthGT?: InputMaybe<Scalars['u8']['input']>;
  first_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  first_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  first_healthLT?: InputMaybe<Scalars['u8']['input']>;
  first_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  first_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  first_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  first_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  game_id?: InputMaybe<Scalars['u32']['input']>;
  game_idEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idGT?: InputMaybe<Scalars['u32']['input']>;
  game_idGTE?: InputMaybe<Scalars['u32']['input']>;
  game_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_idLT?: InputMaybe<Scalars['u32']['input']>;
  game_idLTE?: InputMaybe<Scalars['u32']['input']>;
  game_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hero_card_heal?: InputMaybe<Scalars['bool']['input']>;
  hero_dmg_reduction?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionGT?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionGTE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_dmg_reductionLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionLT?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionLTE?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionNEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_dmg_reductionNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_dmg_reductionNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  hunter_attack?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackGT?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hunter_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackLT?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  hunter_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hunter_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  hunter_health?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthGT?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hunter_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthLT?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  hunter_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hunter_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  magical_attack?: InputMaybe<Scalars['u8']['input']>;
  magical_attackEQ?: InputMaybe<Scalars['u8']['input']>;
  magical_attackGT?: InputMaybe<Scalars['u8']['input']>;
  magical_attackGTE?: InputMaybe<Scalars['u8']['input']>;
  magical_attackIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  magical_attackLIKE?: InputMaybe<Scalars['u8']['input']>;
  magical_attackLT?: InputMaybe<Scalars['u8']['input']>;
  magical_attackLTE?: InputMaybe<Scalars['u8']['input']>;
  magical_attackNEQ?: InputMaybe<Scalars['u8']['input']>;
  magical_attackNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  magical_attackNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  magical_health?: InputMaybe<Scalars['u8']['input']>;
  magical_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  magical_healthGT?: InputMaybe<Scalars['u8']['input']>;
  magical_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  magical_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  magical_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  magical_healthLT?: InputMaybe<Scalars['u8']['input']>;
  magical_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  magical_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  magical_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  magical_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  play_creature_heal?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healEQ?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healGT?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healGTE?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  play_creature_healLIKE?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healLT?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healLTE?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healNEQ?: InputMaybe<Scalars['u8']['input']>;
  play_creature_healNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  play_creature_healNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energy?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyEQ?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyGT?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyGTE?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  start_bonus_energyLIKE?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyLT?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyLTE?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyNEQ?: InputMaybe<Scalars['u8']['input']>;
  start_bonus_energyNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  start_bonus_energyNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type Darkshuffle_GameOrder = {
  direction: OrderDirection;
  field: Darkshuffle_GameOrderField;
};

export enum Darkshuffle_GameOrderField {
  Active = 'ACTIVE',
  ActiveBattleId = 'ACTIVE_BATTLE_ID',
  GameId = 'GAME_ID',
  HeroHealth = 'HERO_HEALTH',
  HeroXp = 'HERO_XP',
  InBattle = 'IN_BATTLE',
  InDraft = 'IN_DRAFT',
  LastNodeId = 'LAST_NODE_ID',
  MapDepth = 'MAP_DEPTH',
  MapLevel = 'MAP_LEVEL',
  MonstersSlain = 'MONSTERS_SLAIN',
  Player = 'PLAYER',
  PlayerName = 'PLAYER_NAME',
  SeasonId = 'SEASON_ID'
}

export type Darkshuffle_GameWhereInput = {
  active?: InputMaybe<Scalars['bool']['input']>;
  active_battle_id?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idEQ?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idGT?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idGTE?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  active_battle_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idLT?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idLTE?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  active_battle_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  active_battle_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_id?: InputMaybe<Scalars['u32']['input']>;
  game_idEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idGT?: InputMaybe<Scalars['u32']['input']>;
  game_idGTE?: InputMaybe<Scalars['u32']['input']>;
  game_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_idLT?: InputMaybe<Scalars['u32']['input']>;
  game_idLTE?: InputMaybe<Scalars['u32']['input']>;
  game_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hero_health?: InputMaybe<Scalars['u8']['input']>;
  hero_healthEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_healthGT?: InputMaybe<Scalars['u8']['input']>;
  hero_healthGTE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_healthLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthLT?: InputMaybe<Scalars['u8']['input']>;
  hero_healthLTE?: InputMaybe<Scalars['u8']['input']>;
  hero_healthNEQ?: InputMaybe<Scalars['u8']['input']>;
  hero_healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hero_healthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  hero_xp?: InputMaybe<Scalars['u16']['input']>;
  hero_xpEQ?: InputMaybe<Scalars['u16']['input']>;
  hero_xpGT?: InputMaybe<Scalars['u16']['input']>;
  hero_xpGTE?: InputMaybe<Scalars['u16']['input']>;
  hero_xpIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hero_xpLIKE?: InputMaybe<Scalars['u16']['input']>;
  hero_xpLT?: InputMaybe<Scalars['u16']['input']>;
  hero_xpLTE?: InputMaybe<Scalars['u16']['input']>;
  hero_xpNEQ?: InputMaybe<Scalars['u16']['input']>;
  hero_xpNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hero_xpNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  in_battle?: InputMaybe<Scalars['bool']['input']>;
  in_draft?: InputMaybe<Scalars['bool']['input']>;
  last_node_id?: InputMaybe<Scalars['u8']['input']>;
  last_node_idEQ?: InputMaybe<Scalars['u8']['input']>;
  last_node_idGT?: InputMaybe<Scalars['u8']['input']>;
  last_node_idGTE?: InputMaybe<Scalars['u8']['input']>;
  last_node_idIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  last_node_idLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_node_idLT?: InputMaybe<Scalars['u8']['input']>;
  last_node_idLTE?: InputMaybe<Scalars['u8']['input']>;
  last_node_idNEQ?: InputMaybe<Scalars['u8']['input']>;
  last_node_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  last_node_idNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  map_depth?: InputMaybe<Scalars['u8']['input']>;
  map_depthEQ?: InputMaybe<Scalars['u8']['input']>;
  map_depthGT?: InputMaybe<Scalars['u8']['input']>;
  map_depthGTE?: InputMaybe<Scalars['u8']['input']>;
  map_depthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  map_depthLIKE?: InputMaybe<Scalars['u8']['input']>;
  map_depthLT?: InputMaybe<Scalars['u8']['input']>;
  map_depthLTE?: InputMaybe<Scalars['u8']['input']>;
  map_depthNEQ?: InputMaybe<Scalars['u8']['input']>;
  map_depthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  map_depthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  map_level?: InputMaybe<Scalars['u8']['input']>;
  map_levelEQ?: InputMaybe<Scalars['u8']['input']>;
  map_levelGT?: InputMaybe<Scalars['u8']['input']>;
  map_levelGTE?: InputMaybe<Scalars['u8']['input']>;
  map_levelIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  map_levelLIKE?: InputMaybe<Scalars['u8']['input']>;
  map_levelLT?: InputMaybe<Scalars['u8']['input']>;
  map_levelLTE?: InputMaybe<Scalars['u8']['input']>;
  map_levelNEQ?: InputMaybe<Scalars['u8']['input']>;
  map_levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  map_levelNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  monsters_slain?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainEQ?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainGT?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainGTE?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  monsters_slainLIKE?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainLT?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainLTE?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainNEQ?: InputMaybe<Scalars['u16']['input']>;
  monsters_slainNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  monsters_slainNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  player?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_name?: InputMaybe<Scalars['felt252']['input']>;
  player_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  player_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  player_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  player_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  player_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  player_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  player_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  player_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  player_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  player_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  season_id?: InputMaybe<Scalars['u32']['input']>;
  season_idEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idGT?: InputMaybe<Scalars['u32']['input']>;
  season_idGTE?: InputMaybe<Scalars['u32']['input']>;
  season_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  season_idLT?: InputMaybe<Scalars['u32']['input']>;
  season_idLTE?: InputMaybe<Scalars['u32']['input']>;
  season_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type Darkshuffle_LeaderboardOrder = {
  direction: OrderDirection;
  field: Darkshuffle_LeaderboardOrderField;
};

export enum Darkshuffle_LeaderboardOrderField {
  Player = 'PLAYER',
  Rank = 'RANK',
  Score = 'SCORE',
  SeasonId = 'SEASON_ID'
}

export type Darkshuffle_LeaderboardWhereInput = {
  player?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  rank?: InputMaybe<Scalars['u8']['input']>;
  rankEQ?: InputMaybe<Scalars['u8']['input']>;
  rankGT?: InputMaybe<Scalars['u8']['input']>;
  rankGTE?: InputMaybe<Scalars['u8']['input']>;
  rankIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  rankLIKE?: InputMaybe<Scalars['u8']['input']>;
  rankLT?: InputMaybe<Scalars['u8']['input']>;
  rankLTE?: InputMaybe<Scalars['u8']['input']>;
  rankNEQ?: InputMaybe<Scalars['u8']['input']>;
  rankNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  rankNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  score?: InputMaybe<Scalars['u16']['input']>;
  scoreEQ?: InputMaybe<Scalars['u16']['input']>;
  scoreGT?: InputMaybe<Scalars['u16']['input']>;
  scoreGTE?: InputMaybe<Scalars['u16']['input']>;
  scoreIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  scoreLIKE?: InputMaybe<Scalars['u16']['input']>;
  scoreLT?: InputMaybe<Scalars['u16']['input']>;
  scoreLTE?: InputMaybe<Scalars['u16']['input']>;
  scoreNEQ?: InputMaybe<Scalars['u16']['input']>;
  scoreNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  scoreNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_id?: InputMaybe<Scalars['u32']['input']>;
  season_idEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idGT?: InputMaybe<Scalars['u32']['input']>;
  season_idGTE?: InputMaybe<Scalars['u32']['input']>;
  season_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  season_idLT?: InputMaybe<Scalars['u32']['input']>;
  season_idLTE?: InputMaybe<Scalars['u32']['input']>;
  season_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type Darkshuffle_MapOrder = {
  direction: OrderDirection;
  field: Darkshuffle_MapOrderField;
};

export enum Darkshuffle_MapOrderField {
  GameId = 'GAME_ID',
  Level = 'LEVEL',
  Seed = 'SEED'
}

export type Darkshuffle_MapWhereInput = {
  game_id?: InputMaybe<Scalars['u32']['input']>;
  game_idEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idGT?: InputMaybe<Scalars['u32']['input']>;
  game_idGTE?: InputMaybe<Scalars['u32']['input']>;
  game_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  game_idLT?: InputMaybe<Scalars['u32']['input']>;
  game_idLTE?: InputMaybe<Scalars['u32']['input']>;
  game_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  game_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  game_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  level?: InputMaybe<Scalars['u8']['input']>;
  levelEQ?: InputMaybe<Scalars['u8']['input']>;
  levelGT?: InputMaybe<Scalars['u8']['input']>;
  levelGTE?: InputMaybe<Scalars['u8']['input']>;
  levelIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelLIKE?: InputMaybe<Scalars['u8']['input']>;
  levelLT?: InputMaybe<Scalars['u8']['input']>;
  levelLTE?: InputMaybe<Scalars['u8']['input']>;
  levelNEQ?: InputMaybe<Scalars['u8']['input']>;
  levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  seed?: InputMaybe<Scalars['u128']['input']>;
  seedEQ?: InputMaybe<Scalars['u128']['input']>;
  seedGT?: InputMaybe<Scalars['u128']['input']>;
  seedGTE?: InputMaybe<Scalars['u128']['input']>;
  seedIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  seedLIKE?: InputMaybe<Scalars['u128']['input']>;
  seedLT?: InputMaybe<Scalars['u128']['input']>;
  seedLTE?: InputMaybe<Scalars['u128']['input']>;
  seedNEQ?: InputMaybe<Scalars['u128']['input']>;
  seedNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  seedNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type Darkshuffle_PlayerRewardOrder = {
  direction: OrderDirection;
  field: Darkshuffle_PlayerRewardOrderField;
};

export enum Darkshuffle_PlayerRewardOrderField {
  Player = 'PLAYER',
  Reward = 'REWARD',
  SeasonId = 'SEASON_ID'
}

export type Darkshuffle_PlayerRewardWhereInput = {
  player?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  reward?: InputMaybe<Scalars['u256']['input']>;
  rewardEQ?: InputMaybe<Scalars['u256']['input']>;
  rewardGT?: InputMaybe<Scalars['u256']['input']>;
  rewardGTE?: InputMaybe<Scalars['u256']['input']>;
  rewardIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  rewardLIKE?: InputMaybe<Scalars['u256']['input']>;
  rewardLT?: InputMaybe<Scalars['u256']['input']>;
  rewardLTE?: InputMaybe<Scalars['u256']['input']>;
  rewardNEQ?: InputMaybe<Scalars['u256']['input']>;
  rewardNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  rewardNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
  season_id?: InputMaybe<Scalars['u32']['input']>;
  season_idEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idGT?: InputMaybe<Scalars['u32']['input']>;
  season_idGTE?: InputMaybe<Scalars['u32']['input']>;
  season_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  season_idLT?: InputMaybe<Scalars['u32']['input']>;
  season_idLTE?: InputMaybe<Scalars['u32']['input']>;
  season_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type Darkshuffle_SeasonOrder = {
  direction: OrderDirection;
  field: Darkshuffle_SeasonOrderField;
};

export enum Darkshuffle_SeasonOrderField {
  ContractAddress = 'CONTRACT_ADDRESS',
  End = 'END',
  EntryAmount = 'ENTRY_AMOUNT',
  Finalized = 'FINALIZED',
  RewardPool = 'REWARD_POOL',
  SeasonId = 'SEASON_ID',
  Start = 'START'
}

export type Darkshuffle_SeasonWhereInput = {
  contract_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  contract_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  contract_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  contract_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  end?: InputMaybe<Scalars['u64']['input']>;
  endEQ?: InputMaybe<Scalars['u64']['input']>;
  endGT?: InputMaybe<Scalars['u64']['input']>;
  endGTE?: InputMaybe<Scalars['u64']['input']>;
  endIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  endLIKE?: InputMaybe<Scalars['u64']['input']>;
  endLT?: InputMaybe<Scalars['u64']['input']>;
  endLTE?: InputMaybe<Scalars['u64']['input']>;
  endNEQ?: InputMaybe<Scalars['u64']['input']>;
  endNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  endNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  entry_amount?: InputMaybe<Scalars['u256']['input']>;
  entry_amountEQ?: InputMaybe<Scalars['u256']['input']>;
  entry_amountGT?: InputMaybe<Scalars['u256']['input']>;
  entry_amountGTE?: InputMaybe<Scalars['u256']['input']>;
  entry_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  entry_amountLIKE?: InputMaybe<Scalars['u256']['input']>;
  entry_amountLT?: InputMaybe<Scalars['u256']['input']>;
  entry_amountLTE?: InputMaybe<Scalars['u256']['input']>;
  entry_amountNEQ?: InputMaybe<Scalars['u256']['input']>;
  entry_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  entry_amountNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
  finalized?: InputMaybe<Scalars['bool']['input']>;
  reward_pool?: InputMaybe<Scalars['u256']['input']>;
  reward_poolEQ?: InputMaybe<Scalars['u256']['input']>;
  reward_poolGT?: InputMaybe<Scalars['u256']['input']>;
  reward_poolGTE?: InputMaybe<Scalars['u256']['input']>;
  reward_poolIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  reward_poolLIKE?: InputMaybe<Scalars['u256']['input']>;
  reward_poolLT?: InputMaybe<Scalars['u256']['input']>;
  reward_poolLTE?: InputMaybe<Scalars['u256']['input']>;
  reward_poolNEQ?: InputMaybe<Scalars['u256']['input']>;
  reward_poolNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  reward_poolNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
  season_id?: InputMaybe<Scalars['u32']['input']>;
  season_idEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idGT?: InputMaybe<Scalars['u32']['input']>;
  season_idGTE?: InputMaybe<Scalars['u32']['input']>;
  season_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  season_idLT?: InputMaybe<Scalars['u32']['input']>;
  season_idLTE?: InputMaybe<Scalars['u32']['input']>;
  season_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  season_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  season_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  start?: InputMaybe<Scalars['u64']['input']>;
  startEQ?: InputMaybe<Scalars['u64']['input']>;
  startGT?: InputMaybe<Scalars['u64']['input']>;
  startGTE?: InputMaybe<Scalars['u64']['input']>;
  startIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  startLIKE?: InputMaybe<Scalars['u64']['input']>;
  startLT?: InputMaybe<Scalars['u64']['input']>;
  startLTE?: InputMaybe<Scalars['u64']['input']>;
  startNEQ?: InputMaybe<Scalars['u64']['input']>;
  startNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  startNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type GetAccountTokensQueryVariables = Exact<{
  accountAddress: Scalars['String']['input'];
}>;


export type GetAccountTokensQuery = { __typename?: 'World__Query', tokenBalances?: { __typename?: 'Token__BalanceConnection', edges?: Array<{ __typename?: 'Token__BalanceEdge', node?: { __typename?: 'Token__Balance', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription: string, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export type GetErc721MintsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetErc721MintsQuery = { __typename?: 'World__Query', tokenTransfers?: { __typename?: 'Token__TransferConnection', edges?: Array<{ __typename?: 'Token__TransferEdge', node?: { __typename?: 'Token__Transfer', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription: string, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];

  constructor(private value: string, public __meta__?: Record<string, any>) {
    super(value);
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const GetAccountTokensDocument = new TypedDocumentString(`
    query getAccountTokens($accountAddress: String!) {
  tokenBalances(accountAddress: $accountAddress, limit: 8000) {
    edges {
      node {
        tokenMetadata {
          __typename
          ... on ERC721__Token {
            tokenId
            metadataDescription
            imagePath
            contractAddress
            metadata
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetAccountTokensQuery, GetAccountTokensQueryVariables>;
export const GetErc721MintsDocument = new TypedDocumentString(`
    query getERC721Mints {
  tokenTransfers(accountAddress: "0x0", limit: 8000) {
    edges {
      node {
        tokenMetadata {
          __typename
          ... on ERC721__Token {
            tokenId
            metadataDescription
            imagePath
            contractAddress
            metadata
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetErc721MintsQuery, GetErc721MintsQueryVariables>;