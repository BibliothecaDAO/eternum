use core::num::traits::Zero;
use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use crate::alias::ID;
use crate::constants::{RESOURCE_PRECISION, WORLD_CONFIG_ID};
use crate::models::config::HyperstrtConstructConfig;
use crate::models::guild::GuildMember;
use crate::models::season::SeasonPrize;
use starknet::ContractAddress;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureGlobals {
    #[key]
    pub world_id: ID,
    pub created_count: u32,
    pub completed_count: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Hyperstructure {
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
    fn initialize(ref world: WorldStorage, hyperstructure_id: ID) {
        let mut hyperstructure_requirements: HyperstructureRequirements = Default::default();
        hyperstructure_requirements.hyperstructure_id = hyperstructure_id;
        world.write_model(@hyperstructure_requirements);
    }

    fn get_resource_points(ref world: WorldStorage, resource_type: u8) -> u128 {
        let construction_cost_config: HyperstrtConstructConfig = world.read_model(resource_type);
        construction_cost_config.resource_contribution_points.into()
    }

    // Formula for each resource is = randomness / resource_type % (max - min)
    fn get_amount_needed(ref world: WorldStorage, hyperstructure: Hyperstructure, resource_type: u8) -> u128 {
        let construction_cost_config: HyperstrtConstructConfig = world.read_model(resource_type);
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


    fn write_current_amount(ref world: WorldStorage, hyperstructure_id: ID, resource_type: u8, amount: u128) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
                Self::current_amount_selector(resource_type.into()),
                amount,
            );
    }

    fn write_needed_resource_total(ref world: WorldStorage, hyperstructure_id: ID, total: u128) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
                selector!("needed_resource_total"),
                total,
            );
    }

    fn write_current_resource_total(ref world: WorldStorage, hyperstructure_id: ID, total: u128) {
        return world
            .write_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
                selector!("current_resource_total"),
                total,
            );
    }


    fn read_current_amount(ref world: WorldStorage, hyperstructure_id: ID, resource_type: u8) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
                Self::current_amount_selector(resource_type.into()),
            );
    }


    fn read_current_resource_total(ref world: WorldStorage, hyperstructure_id: ID) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
                selector!("current_resource_total"),
            );
    }


    fn read_needed_resource_total(ref world: WorldStorage, hyperstructure_id: ID) -> u128 {
        return world
            .read_member(
                Model::<HyperstructureRequirements>::ptr_from_keys(hyperstructure_id),
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
    pub hyperstructure_id: ID,
    pub start_at: u64,
    pub shareholders: Span<(ContractAddress, u16)>,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerConstructionPoints {
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
    pub address: ContractAddress,
    pub registered_points: u128,
    pub prize_claimed: bool,
}

#[generate_trait]
pub impl PlayerRegisteredPointsImpl of PlayerRegisteredPointsTrait {
    fn register_points(ref world: WorldStorage, address: ContractAddress, points: u128) {
        if points.is_non_zero() {
            let mut player_registered_points: PlayerRegisteredPoints = world.read_model(address);
            player_registered_points.registered_points += points;
            world.write_model(@player_registered_points);

            // increase global total registered points
            let mut season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);
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
                let guild_member: GuildMember = world.read_model(contributor_address);
                let owner_guild_member: GuildMember = world.read_model(owner_address);
                assert!(
                    owner_guild_member.guild_id.is_non_zero(),
                    "hyperstructure owner needs to join a guild or change hyperstructure construction permissions",
                );
                assert!(guild_member.guild_id == owner_guild_member.guild_id, "not in the same guild");
            },
        }
    }
}
