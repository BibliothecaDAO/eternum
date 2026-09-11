use core::num::traits::Zero;
use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use starknet::ContractAddress;
use crate::alias::ID;
use crate::constants::RESOURCE_PRECISION;
use crate::models::config::HyperstrtConstructConfig;
use crate::models::game::GameRegistry;
use crate::models::guild::GuildMember;
use crate::models::season::SeasonPrize;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureGlobals {
    #[key]
    pub game_id: u32,
    pub created_count: u32,
    pub completed_count: u32,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct CompletedHyperstructure {
    #[key]
    pub game_id: u32,
    #[key]
    pub index: u32,
    pub hyperstructure_id: ID,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct HyperstructureIndex {
    #[key]
    pub game_id: u32,
    #[key]
    pub hyperstructure_id: ID,
    pub index_plus_one: u32,
}

#[generate_trait]
pub impl CompletedHyperstructureImpl of CompletedHyperstructureTrait {
    fn record(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID) {
        let mut globals: HyperstructureGlobals = world.read_model(game_id);
        Self::write_entry(ref world, game_id, globals.completed_count, hyperstructure_id);
        globals.completed_count += 1;
        world.write_model(@globals);
    }

    fn backfill(ref world: WorldStorage, game_id: u32, start_index: u32, ids: Span<ID>) {
        let globals: HyperstructureGlobals = world.read_model(game_id);
        assert!(
            !ids.is_empty() && start_index + ids.len() <= globals.completed_count,
            "Eternum: invalid completion backfill range",
        );
        for offset in 0..ids.len() {
            let id = *ids.at(offset);
            let hyperstructure: Hyperstructure = world.read_model((game_id, id));
            assert!(
                hyperstructure.initialized && hyperstructure.completed,
                "Eternum: backfill requires a completed hyperstructure",
            );
            Self::write_entry(ref world, game_id, start_index + offset, id);
        }
    }

    fn write_entry(ref world: WorldStorage, game_id: u32, index: u32, hyperstructure_id: ID) {
        let existing: CompletedHyperstructure = world.read_model((game_id, index));
        assert!(
            existing.hyperstructure_id == 0 || existing.hyperstructure_id == hyperstructure_id,
            "Eternum: completion index already assigned",
        );
        let reverse: HyperstructureIndex = world.read_model((game_id, hyperstructure_id));
        assert!(
            reverse.index_plus_one == 0 || reverse.index_plus_one == index + 1, "Eternum: duplicate completion index",
        );
        world.write_model(@CompletedHyperstructure { game_id, index, hyperstructure_id });
        world.write_model(@HyperstructureIndex { game_id, hyperstructure_id, index_plus_one: index + 1 });
    }

    fn get(world: WorldStorage, game_id: u32, index: u32) -> ID {
        let entry: CompletedHyperstructure = world.read_model((game_id, index));
        assert!(entry.hyperstructure_id.is_non_zero(), "Eternum: completed hyperstructure index is incomplete");
        entry.hyperstructure_id
    }
}

#[cfg(test)]
mod completion_tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorage;
    use dojo_snf_test::{NamespaceDef, TestResource, spawn_test_world};
    use crate::constants::DEFAULT_NS_STR;
    use super::{CompletedHyperstructureImpl, ConstructionAccess, Hyperstructure, HyperstructureGlobals};

    fn setup() -> WorldStorage {
        spawn_test_world(
            [
                NamespaceDef {
                    namespace: DEFAULT_NS_STR(),
                    resources: [
                        TestResource::Model("SharePointsCheckpoint"), TestResource::Model("HyperstructureGlobals"),
                        TestResource::Model("Hyperstructure"), TestResource::Model("CompletedHyperstructure"),
                        TestResource::Model("HyperstructureIndex"),
                    ]
                        .span(),
                }
            ]
                .span(),
        )
    }

    #[test]
    fn completion_index_preserves_discovery_count_and_game_isolation() {
        let mut world = setup();
        world.write_model_test(@HyperstructureGlobals { game_id: 1, created_count: 5, completed_count: 0 });
        world.write_model_test(@HyperstructureGlobals { game_id: 2, created_count: 3, completed_count: 0 });
        CompletedHyperstructureImpl::record(ref world, 1, 101);
        CompletedHyperstructureImpl::record(ref world, 2, 201);
        CompletedHyperstructureImpl::record(ref world, 1, 105);

        let first: HyperstructureGlobals = world.read_model(1_u32);
        let second: HyperstructureGlobals = world.read_model(2_u32);
        assert!(first.created_count == 5 && first.completed_count == 2, "first game counters changed incorrectly");
        assert!(second.created_count == 3 && second.completed_count == 1, "second game counters changed incorrectly");
        assert!(CompletedHyperstructureImpl::get(world, 1, 0) == 101, "first completion missing");
        assert!(CompletedHyperstructureImpl::get(world, 1, 1) == 105, "second completion missing");
        assert!(CompletedHyperstructureImpl::get(world, 2, 0) == 201, "games share an index");
    }

    #[test]
    fn backfill_is_idempotent_and_preserves_existing_counters() {
        let mut world = setup();
        world.write_model_test(@HyperstructureGlobals { game_id: 1, created_count: 3, completed_count: 1 });
        world
            .write_model_test(
                @Hyperstructure {
                    game_id: 1,
                    hyperstructure_id: 105,
                    initialized: true,
                    completed: true,
                    access: ConstructionAccess::Public,
                    randomness: 0,
                    points_multiplier: 2,
                },
            );
        CompletedHyperstructureImpl::backfill(ref world, 1, 0, [105].span());
        CompletedHyperstructureImpl::backfill(ref world, 1, 0, [105].span());
        let globals: HyperstructureGlobals = world.read_model(1_u32);
        assert!(globals.created_count == 3 && globals.completed_count == 1, "backfill changed counters");
        assert!(CompletedHyperstructureImpl::get(world, 1, 0) == 105, "backfill missing");
    }

    #[test]
    #[should_panic(expected: "Eternum: duplicate completion index")]
    fn backfill_cannot_count_a_hyperstructure_twice() {
        let mut world = setup();
        world.write_model_test(@HyperstructureGlobals { game_id: 1, created_count: 3, completed_count: 2 });
        world
            .write_model_test(
                @Hyperstructure {
                    game_id: 1,
                    hyperstructure_id: 105,
                    initialized: true,
                    completed: true,
                    access: ConstructionAccess::Public,
                    randomness: 0,
                    points_multiplier: 2,
                },
            );
        CompletedHyperstructureImpl::backfill(ref world, 1, 0, [105, 105].span());
    }

    #[test]
    #[should_panic(expected: "Eternum: completed hyperstructure index is incomplete")]
    fn missing_completion_cannot_be_silently_skipped() {
        CompletedHyperstructureImpl::get(setup(), 1, 0);
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Hyperstructure {
    #[key]
    pub game_id: u32,
    #[key]
    pub hyperstructure_id: ID,
    pub initialized: bool,
    pub completed: bool,
    pub access: ConstructionAccess,
    pub randomness: felt252,
    pub points_multiplier: u8,
}

#[derive(Introspect, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct HyperstructureRequirements {
    #[key]
    pub game_id: u32,
    #[key]
    pub hyperstructure_id: ID,
    pub stone_amount_current: u128,
    pub coal_amount_current: u128,
    pub wood_amount_current: u128,
    pub copper_amount_current: u128,
    pub ironwood_amount_current: u128,
    pub obsidian_amount_current: u128,
    pub gold_amount_current: u128,
    pub silver_amount_current: u128,
    pub mithral_amount_current: u128,
    pub alchemicsilver_amount_current: u128,
    pub coldiron_amount_current: u128,
    pub deepcrystal_amount_current: u128,
    pub ruby_amount_current: u128,
    pub diamonds_amount_current: u128,
    pub hartwood_amount_current: u128,
    pub ignium_amount_current: u128,
    pub twilightquartz_amount_current: u128,
    pub trueice_amount_current: u128,
    pub adamantine_amount_current: u128,
    pub sapphire_amount_current: u128,
    pub etherealsilica_amount_current: u128,
    pub dragonhide_amount_current: u128,
    pub labor_amount_current: u128,
    //
    pub current_resource_total: u128,
    pub needed_resource_total: u128,
}


#[generate_trait]
pub impl HyperstructureRequirementsImpl of HyperstructureRequirementsTrait {
    fn initialize(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID) {
        let mut hyperstructure_requirements: HyperstructureRequirements = Default::default();
        hyperstructure_requirements.game_id = game_id;
        hyperstructure_requirements.hyperstructure_id = hyperstructure_id;
        world.write_model(@hyperstructure_requirements);
    }

    fn get_resource_points(ref world: WorldStorage, game_id: u32, resource_type: u8) -> u128 {
        let game: GameRegistry = world.read_model(game_id);
        let construction_cost_config: HyperstrtConstructConfig = world.read_model((game.preset_id, resource_type));
        construction_cost_config.resource_contribution_points.into()
    }

    // Formula for each resource is = randomness / resource_type % (max - min)
    fn get_amount_needed(ref world: WorldStorage, hyperstructure: Hyperstructure, resource_type: u8) -> u128 {
        let game: GameRegistry = world.read_model(hyperstructure.game_id);
        let construction_cost_config: HyperstrtConstructConfig = world.read_model((game.preset_id, resource_type));
        let min_amount = construction_cost_config.min_amount;
        let max_amount = construction_cost_config.max_amount;
        let needed_amount = if min_amount == max_amount {
            max_amount
        } else {
            let randomness: u256 = hyperstructure.randomness.into();
            let unique_resource_randomness = randomness / resource_type.into();
            let additional = (unique_resource_randomness % (max_amount - min_amount).into());
            min_amount + additional.try_into().unwrap()
        };
        needed_amount.into() * RESOURCE_PRECISION
    }


    fn write_current_amount(
        ref world: WorldStorage, game_id: u32, hyperstructure_id: ID, resource_type: u8, amount: u128,
    ) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                Self::current_amount_selector(resource_type.into()),
                amount,
            );
    }

    fn write_needed_resource_total(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID, total: u128) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                selector!("needed_resource_total"),
                total,
            );
    }

    fn write_current_resource_total(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID, total: u128) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                selector!("current_resource_total"),
                total,
            );
    }


    fn read_current_amount(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID, resource_type: u8) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                Self::current_amount_selector(resource_type.into()),
            );
    }


    fn read_current_resource_total(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                selector!("current_resource_total"),
            );
    }


    fn read_needed_resource_total(ref world: WorldStorage, game_id: u32, hyperstructure_id: ID) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys((game_id, hyperstructure_id)),
                selector!("needed_resource_total"),
            );
    }

    fn current_amount_selector(resource_type: felt252) -> felt252 {
        match resource_type {
            0 => panic!("Invalid resource type"),
            1 => selector!("stone_amount_current"),
            2 => selector!("coal_amount_current"),
            3 => selector!("wood_amount_current"),
            4 => selector!("copper_amount_current"),
            5 => selector!("ironwood_amount_current"),
            6 => selector!("obsidian_amount_current"),
            7 => selector!("gold_amount_current"),
            8 => selector!("silver_amount_current"),
            9 => selector!("mithral_amount_current"),
            10 => selector!("alchemicsilver_amount_current"),
            11 => selector!("coldiron_amount_current"),
            12 => selector!("deepcrystal_amount_current"),
            13 => selector!("ruby_amount_current"),
            14 => selector!("diamonds_amount_current"),
            15 => selector!("hartwood_amount_current"),
            16 => selector!("ignium_amount_current"),
            17 => selector!("twilightquartz_amount_current"),
            18 => selector!("trueice_amount_current"),
            19 => selector!("adamantine_amount_current"),
            20 => selector!("sapphire_amount_current"),
            21 => selector!("etherealsilica_amount_current"),
            22 => selector!("dragonhide_amount_current"),
            23 => selector!("labor_amount_current"),
            _ => panic!("Invalid resource type,"),
        }
    }
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureShareholders {
    #[key]
    pub game_id: u32,
    #[key]
    pub hyperstructure_id: ID,
    pub start_at: u64,
    pub shareholders: Span<(ContractAddress, u16)>,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerConstructionPoints {
    #[key]
    pub game_id: u32,
    #[key]
    pub address: ContractAddress,
    #[key]
    pub hyperstructure_id: ID,
    pub unregistered_points: u128,
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerRegisteredPoints {
    #[key]
    pub game_id: u32,
    #[key]
    pub address: ContractAddress,
    pub registered_points: u128,
}

#[generate_trait]
pub impl PlayerRegisteredPointsImpl of PlayerRegisteredPointsTrait {
    fn register_points(ref world: WorldStorage, game_id: u32, address: ContractAddress, points: u128) {
        if points.is_non_zero() {
            let mut player_registered_points: PlayerRegisteredPoints = world.read_model((game_id, address));
            player_registered_points.registered_points += points;
            world.write_model(@player_registered_points);

            // increase global total registered points
            let mut season_prize: SeasonPrize = world.read_model(game_id);
            season_prize.total_registered_points += points;
            world.write_model(@season_prize);
        }
    }
}


#[derive(PartialEq, Copy, Drop, Serde, IntrospectPacked, Default, DojoStore)]
pub enum ConstructionAccess {
    #[default]
    Public,
    Private,
    GuildOnly,
}

#[generate_trait]
pub impl HyperstructureConstructionAccessImpl of HyperstructureConstructionAccessTrait {
    fn assert_caller_construction_access(
        self: Hyperstructure, ref world: WorldStorage, owner_address: ContractAddress,
    ) {
        let contributor_address = starknet::get_caller_address();
        match self.access {
            ConstructionAccess::Public => {},
            ConstructionAccess::Private => {
                assert!(contributor_address == owner_address, "Hyperstructure is private");
            },
            ConstructionAccess::GuildOnly => {
                let guild_member: GuildMember = world.read_model((self.game_id, contributor_address));
                let owner_guild_member: GuildMember = world.read_model((self.game_id, owner_address));
                assert!(
                    owner_guild_member.guild_id.is_non_zero(),
                    "hyperstructure owner needs to join a guild or change hyperstructure construction permissions",
                );
                assert!(guild_member.guild_id == owner_guild_member.guild_id, "not in the same guild");
            },
        }
    }
}

/// Records a contiguous prefix checkpointed after the game's immutable end time.
#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct SharePointsCheckpoint {
    #[key]
    pub game_id: u32,
    pub completed_count: u32,
    pub end_at: u64,
}
