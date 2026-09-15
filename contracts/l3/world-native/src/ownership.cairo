use starknet::ContractAddress;
use crate::commands::ExecutionContext;

pub const VILLAGE_CATEGORY: u8 = 5;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TransferOwnership {
    pub entity_id: u32,
    pub new_owner: ContractAddress,
}

#[starknet::interface]
pub trait IStructureOwnership<T> {
    fn transfer_structure_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, command: TransferOwnership, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait IAgentOwnership<T> {
    fn agent_owner(self: @T, game_id: u32, explorer_id: u32) -> ContractAddress;
    fn transfer_agent_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, command: TransferOwnership, context: ExecutionContext,
    );
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct WonderFaith {
    pub last_recorded_owner: ContractAddress,
    pub claimed_points: u128,
    pub claim_per_sec: u32,
    pub claim_last_at: u64,
    pub owner_claim_per_sec: u32,
    pub num_structures_pledged: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FaithfulStructure {
    pub wonder_id: u32,
    pub faithful_since: u64,
    pub fp_to_wonder_owner_per_sec: u16,
    pub fp_to_struct_owner_per_sec: u16,
    pub last_recorded_owner: ContractAddress,
}

#[derive(Copy, Drop, Default, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerFaithPoints {
    pub points_claimed: u128,
    pub points_per_sec_as_owner: u32,
    pub points_per_sec_as_pledger: u32,
    pub last_updated_at: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WonderFaithWinners {
    pub high_score: u128,
    pub wonder_ids: Span<u32>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PlayerFaithKey {
    pub game_id: u32,
    pub player: ContractAddress,
    pub wonder_id: u32,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub struct Accrual {
    pub wonder_id: u32,
    pub new_points: u128,
    pub total_points: u128,
}

#[starknet::interface]
pub trait IFaithOwnershipViews<T> {
    fn wonder_faith(self: @T, key: crate::resources::ResourceKey) -> WonderFaith;
    fn faithful_structure(self: @T, key: crate::resources::ResourceKey) -> FaithfulStructure;
    fn player_faith_points(self: @T, key: PlayerFaithKey) -> PlayerFaithPoints;
    fn wonder_faith_winners(self: @T, game_id: u32) -> WonderFaithWinners;
}

#[starknet::component]
pub mod FaithOwnershipState {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{Accrual, FaithfulStructure, PlayerFaithPoints, WonderFaith, WonderFaithWinners};

    #[storage]
    pub struct Storage {
        pub faith_wonders: Map<(u32, u32), WonderFaith>,
        pub faith_pledges: Map<(u32, u32), FaithfulStructure>,
        pub faith_players: Map<(u32, ContractAddress, u32), PlayerFaithPoints>,
        pub faith_high_scores: Map<u32, u128>,
        pub faith_winner_counts: Map<u32, u32>,
        pub faith_winner_ids: Map<(u32, u32), u32>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn transfer(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            structure_id: u32,
            new_owner: ContractAddress,
            now: u64,
            season_end: u64,
        ) -> Option<Accrual> {
            let mut wonder = self.faith_wonders.read((game_id, structure_id));
            let mut accrual = None;
            if wonder.last_recorded_owner != 0.try_into().unwrap() && wonder.last_recorded_owner != new_owner {
                accrual = self.settle_wonder(game_id, structure_id, ref wonder, now, season_end);
                self
                    .update_rates(
                        game_id,
                        wonder.last_recorded_owner,
                        structure_id,
                        false,
                        wonder.owner_claim_per_sec,
                        0,
                        now,
                        season_end,
                    );
                self
                    .update_rates(
                        game_id, new_owner, structure_id, true, wonder.owner_claim_per_sec, 0, now, season_end,
                    );
                wonder.last_recorded_owner = new_owner;
                self.write_wonder(game_id, structure_id, wonder);
            }
            let mut pledge = self.faith_pledges.read((game_id, structure_id));
            if pledge.wonder_id != 0 && pledge.last_recorded_owner != new_owner {
                let rate = pledge.fp_to_struct_owner_per_sec.into();
                self
                    .update_rates(
                        game_id, pledge.last_recorded_owner, pledge.wonder_id, false, 0, rate, now, season_end,
                    );
                self.update_rates(game_id, new_owner, pledge.wonder_id, true, 0, rate, now, season_end);
                pledge.last_recorded_owner = new_owner;
                self.faith_pledges.write((game_id, structure_id), pledge);
                let mut values = array![];
                pledge.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'FaithfulStructure',
                            keys: array![game_id.into(), structure_id.into()].span(),
                            values: values.span(),
                        },
                    );
            }
            accrual
        }
        fn settle_wonder(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            wonder_id: u32,
            ref wonder: WonderFaith,
            now: u64,
            season_end: u64,
        ) -> Option<Accrual> {
            let end_time = if season_end < now {
                season_end
            } else {
                now
            };
            if wonder.claim_last_at == 0 || end_time <= wonder.claim_last_at {
                if wonder.claim_last_at == 0 {
                    wonder.claim_last_at = now;
                }
                return None;
            }
            let new_points: u128 = wonder.claim_per_sec.into() * (end_time - wonder.claim_last_at).into();
            wonder.claimed_points += new_points;
            wonder.claim_last_at = end_time;
            self.update_winners(game_id, wonder_id, wonder.claimed_points);
            Some(Accrual { wonder_id, new_points, total_points: wonder.claimed_points })
        }
        fn update_rates(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            player: ContractAddress,
            wonder_id: u32,
            add: bool,
            owner_delta: u32,
            pledger_delta: u32,
            now: u64,
            season_end: u64,
        ) {
            if player == 0.try_into().unwrap() {
                return;
            }
            let end_time = if season_end < now {
                season_end
            } else {
                now
            };
            let mut points = self.faith_players.read((game_id, player, wonder_id));
            let elapsed = if points.last_updated_at > 0 && end_time > points.last_updated_at {
                end_time - points.last_updated_at
            } else {
                0
            };
            let rate = points.points_per_sec_as_owner + points.points_per_sec_as_pledger;
            points.points_claimed += rate.into() * elapsed.into();
            points.last_updated_at = end_time;
            if add {
                points.points_per_sec_as_owner += owner_delta;
                points.points_per_sec_as_pledger += pledger_delta;
            } else {
                points.points_per_sec_as_owner -= owner_delta;
                points.points_per_sec_as_pledger -= pledger_delta;
            }
            self.faith_players.write((game_id, player, wonder_id), points);
            let mut values = array![];
            points.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerFaithPoints',
                        keys: array![game_id.into(), player.into(), wonder_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn write_wonder(ref self: ComponentState<TContractState>, game_id: u32, wonder_id: u32, wonder: WonderFaith) {
            self.faith_wonders.write((game_id, wonder_id), wonder);
            let mut values = array![];
            wonder.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'WonderFaith',
                        keys: array![game_id.into(), wonder_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn winners(self: @ComponentState<TContractState>, game_id: u32) -> WonderFaithWinners {
            let mut ids = array![];
            for index in 0..self.faith_winner_counts.read(game_id) {
                ids.append(self.faith_winner_ids.read((game_id, index)));
            }
            WonderFaithWinners { high_score: self.faith_high_scores.read(game_id), wonder_ids: ids.span() }
        }
        fn update_winners(ref self: ComponentState<TContractState>, game_id: u32, wonder_id: u32, score: u128) {
            let winners = self.winners(game_id);
            if score > winners.high_score {
                self.faith_high_scores.write(game_id, score);
                self.faith_winner_counts.write(game_id, 1);
                self.faith_winner_ids.write((game_id, 0), wonder_id);
            } else if score == winners.high_score && score > 0 {
                for id in winners.wonder_ids {
                    if *id == wonder_id {
                        return;
                    }
                }
                let count = self.faith_winner_counts.read(game_id);
                self.faith_winner_ids.write((game_id, count), wonder_id);
                self.faith_winner_counts.write(game_id, count + 1);
            } else {
                return;
            }
            let mut values = array![];
            self.winners(game_id).serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'WonderFaithWinners',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FaithPointsClaimedStory {
    pub wonder_id: u32,
    pub new_points: u128,
    pub total_points: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructureLevelUpStory {
    pub new_level: u8,
}

// Native history variants append independently of the legacy wire discriminants.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Story {
    FaithPointsClaimedStory: FaithPointsClaimedStory,
    StructureLevelUpStory: StructureLevelUpStory,
    RealmCreatedStory: RealmCreatedStory,
    GuardAddStory: GuardAddStory,
}

#[derive(Drop, starknet::Event)]
pub struct StoryEvent {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub id: u32,
    #[key]
    pub owner: Option<ContractAddress>,
    #[key]
    pub entity_id: Option<u32>,
    #[key]
    pub tx_hash: felt252,
    pub story: Story,
    pub timestamp: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmCreatedStory {
    pub coord: crate::troops::Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardAddStory {
    pub structure_id: u32,
    pub slot: u8,
    pub category: u8,
    pub tier: u8,
    pub amount: u128,
}
