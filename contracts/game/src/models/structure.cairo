use alexandria_math::{BitShift};
use core::num::traits::zero::Zero;
use core::traits::Into;
use dojo::{model::{Model, ModelStorage}, world::WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::models::config::{
    BattleConfig, SeasonConfig, StructureMaxLevelConfig, TickInterval, WorldConfigUtilImpl,
};
use s1_eternum::models::config::{TickTrait};
use s1_eternum::models::position::{Coord, Direction};
use s1_eternum::models::stamina::Stamina;
use s1_eternum::models::troop::{GuardTroops, TroopBoosts, TroopTier, TroopType, Troops};
use starknet::ContractAddress;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Wonder {
    #[key]
    pub structure_id: ID,
    pub coord: Coord,
    pub realm_id: u16,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureReservation {
    #[key]
    pub coord: Coord,
    pub reserved: bool,
}


#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureVillageSlots {
    #[key]
    pub connected_realm_entity_id: ID,
    pub connected_realm_id: u16,
    pub connected_realm_coord: Coord,
    pub directions_left: Span<Direction>,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureOwnerStats {
    #[key]
    pub owner: ContractAddress,
    pub structures_num: u32,
    pub name: felt252,
}

#[generate_trait]
pub impl StructureOwnerStatsImpl of StructureOwnerStatsTrait {
    fn increase(ref world: WorldStorage, owner: ContractAddress) {
        let mut so_stats: StructureOwnerStats = world.read_model(owner);
        so_stats.structures_num += 1;
        world.write_model(@so_stats);
    }

    fn decrease(ref world: WorldStorage, owner: ContractAddress) {
        let mut so_stats: StructureOwnerStats = world.read_model(owner);
        if so_stats.structures_num > 0 {
            so_stats.structures_num -= 1;
            world.write_model(@so_stats);
        }
    }
}


// todo: obtain each value as needed not all at once

// todo: add hard limit of troop to be something like 20
// so the stucture explorers array does not get too big

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Structure {
    #[key]
    pub entity_id: ID,
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub troop_guards: GuardTroops,
    pub troop_explorers: Span<ID>,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
    pub category: u8,
}

#[generate_trait]
pub impl StructureOwnerStoreImpl of StructureOwnerStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> ContractAddress {
        let owner = world.read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("owner"));
        return owner;
    }

    fn store(owner: ContractAddress, ref world: WorldStorage, structure_id: ID) {
        let previous_owner: ContractAddress = Self::retrieve(ref world, structure_id);
        StructureOwnerStatsImpl::decrease(ref world, previous_owner);

        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("owner"), owner);
        StructureOwnerStatsImpl::increase(ref world, owner);
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct StructureBase {
    pub troop_guard_count: u8,
    pub troop_explorer_count: u16,
    pub troop_max_guard_count: u8,
    pub troop_max_explorer_count: u16,
    pub created_at: u32,
    pub category: u8,
    pub coord_x: u32,
    pub coord_y: u32,
    pub level: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
pub struct StructureMetadata {
    // associated with realm
    pub realm_id: u16,
    pub order: u8,
    pub has_wonder: bool,
    pub villages_count: u8,
    // associated with village
    pub village_realm: ID,
}

#[generate_trait]
pub impl StructureBaseImpl of StructureBaseTrait {
    fn assert_exists(self: StructureBase) {
        assert!(self.exists(), "entity is not a structure")
    }

    fn assert_not_cloaked(
        self: StructureBase, battle_config: BattleConfig, tick_config: TickInterval, season_config: SeasonConfig,
    ) {
        let (is_cloaked, reason) = self.is_cloaked(battle_config, tick_config, season_config);
        assert!(!is_cloaked, "{}", reason);
    }

    fn coord(self: StructureBase) -> Coord {
        return Coord { x: self.coord_x, y: self.coord_y };
    }

    fn exists(self: StructureBase) -> bool {
        self.category != StructureCategory::None.into()
    }

    fn is_not_cloaked(
        self: StructureBase, battle_config: BattleConfig, tick_config: TickInterval, season_config: SeasonConfig,
    ) -> bool {
        let (is_cloaked, _) = self.is_cloaked(battle_config, tick_config, season_config);
        return !is_cloaked;
    }

    fn is_cloaked(
        self: StructureBase, battle_config: BattleConfig, tick_config: TickInterval, season_config: SeasonConfig,
    ) -> (bool, ByteArray) {
        let current_tick = tick_config.current();
        let mut allow_attack_tick: u64 = tick_config.at(season_config.start_main_at)
            + battle_config.regular_immunity_ticks.into();

        if current_tick < allow_attack_tick {
            return (true, "This entity can't be attacked until immunity period ends");
        }

        return (false, "");
    }

    fn max_level(self: StructureBase, world: WorldStorage) -> u8 {
        let structure_max_level_config: StructureMaxLevelConfig = WorldConfigUtilImpl::get_member(
            world, selector!("structure_max_level_config"),
        );
        if self.category == StructureCategory::Realm.into() {
            return structure_max_level_config.realm_max;
        } else if self.category == StructureCategory::Village.into() {
            return structure_max_level_config.village_max;
        } else {
            0
        }
    }
}

#[generate_trait]
pub impl StructureBaseStoreImpl of StructureBaseStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> StructureBase {
        let base = world.read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("base"));
        return base;
    }

    fn store(ref self: StructureBase, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("base"), self);
    }
}

#[generate_trait]
pub impl StructureTroopGuardStoreImpl of StructureTroopGuardStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> GuardTroops {
        let troops = world.read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("troop_guards"));
        return troops;
    }

    fn store(ref self: GuardTroops, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("troop_guards"), self);
    }
}

#[generate_trait]
pub impl StructureTroopExplorerStoreImpl of StructureTroopExplorerStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> Span<ID> {
        let explorers = world
            .read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("troop_explorers"));
        return explorers;
    }

    fn store(self: Span<ID>, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("troop_explorers"), self);
    }
}

#[generate_trait]
pub impl StructureResourcesPackedStoreImpl of StructureResourcesPackedStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> u128 {
        let resources_packed = world
            .read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("resources_packed"));
        return resources_packed;
    }

    fn store(self: u128, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("resources_packed"), self);
    }
}

#[generate_trait]
pub impl StructureMetadataStoreImpl of StructureMetadataStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> StructureMetadata {
        let metadata = world.read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("metadata"));
        return metadata;
    }

    fn store(self: StructureMetadata, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("metadata"), self);
    }
}


pub impl StructureDefaultImpl of Default<Structure> {
    fn default() -> Structure {
        let troops: Troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            boosts: TroopBoosts {
                incr_damage_dealt_percent_num: 0,
                incr_damage_dealt_end_tick: 0,
                decr_damage_gotten_percent_num: 0,
                decr_damage_gotten_end_tick: 0,
                incr_stamina_regen_percent_num: 0,
                incr_stamina_regen_tick_count: 0,
                incr_explore_reward_percent_num: 0,
                incr_explore_reward_end_tick: 0,
            },
        };
        Structure {
            entity_id: 0,
            owner: Zero::zero(),
            base: StructureBase {
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: 0,
                troop_max_explorer_count: 0,
                created_at: 0,
                category: 0,
                coord_x: 0,
                coord_y: 0,
                level: 0,
            },
            troop_guards: GuardTroops {
                delta: troops,
                charlie: troops,
                bravo: troops,
                alpha: troops,
                delta_destroyed_tick: 0,
                charlie_destroyed_tick: 0,
                bravo_destroyed_tick: 0,
                alpha_destroyed_tick: 0,
            },
            troop_explorers: array![].span(),
            resources_packed: 0,
            metadata: Default::default(),
            category: 0,
        }
    }
}


#[generate_trait]
pub impl StructureImpl of StructureTrait {
    fn new(
        entity_id: ID, category: StructureCategory, coord: Coord, resources_packed: u128, metadata: StructureMetadata,
    ) -> Structure {
        assert!(category != StructureCategory::None, "category cannot be none");
        let mut structure: Structure = Default::default();
        structure.entity_id = entity_id;
        structure.category = category.into();
        structure.base.category = category.into();
        structure.base.coord_x = coord.x;
        structure.base.coord_y = coord.y;
        structure.resources_packed = resources_packed;
        structure.metadata = metadata;
        match category {
            StructureCategory::Realm => {
                structure.base.troop_max_explorer_count = 1;
                structure.base.troop_max_guard_count = 1; // 1 guard, 1 explorer
            },
            StructureCategory::Hyperstructure => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 4; // 4 guards, 0 explorers
            },
            StructureCategory::Bank => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 4; // 4 guards, 0 explorers
            },
            StructureCategory::FragmentMine => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 1; // 1 guard, 0 explorers
            },
            StructureCategory::Village => { // todo: check if this is correct
                structure.base.troop_max_explorer_count = 1;
                structure.base.troop_max_guard_count = 1; // 1 guard, 1 explorer
            },
            _ => { panic!("invalid structure category"); },
        }
        structure.base.created_at = starknet::get_block_timestamp().try_into().unwrap();
        structure
    }
}


#[derive(PartialEq, Copy, Drop, Serde, Default)]
pub enum StructureCategory {
    #[default]
    None,
    Realm,
    Hyperstructure,
    Bank,
    FragmentMine,
    Village,
}

pub impl StructureCategoryIntoFelt252 of Into<StructureCategory, felt252> {
    fn into(self: StructureCategory) -> felt252 {
        match self {
            StructureCategory::None => 0,
            StructureCategory::Realm => 1,
            StructureCategory::Hyperstructure => 2,
            StructureCategory::Bank => 3,
            StructureCategory::FragmentMine => 4,
            StructureCategory::Village => 5,
        }
    }
}

pub impl StructureCategoryIntoU8 of Into<StructureCategory, u8> {
    fn into(self: StructureCategory) -> u8 {
        match self {
            StructureCategory::None => 0,
            StructureCategory::Realm => 1,
            StructureCategory::Hyperstructure => 2,
            StructureCategory::Bank => 3,
            StructureCategory::FragmentMine => 4,
            StructureCategory::Village => 5,
        }
    }
}


#[generate_trait]
pub impl StructureResourcesImpl of StructureResourcesTrait {
    fn PACKING_TOTAL_BITS_AVAILABLE() -> u8 {
        128 // 128 bits available for all resources
    }

    fn PACKING_MAX_BITS_PER_RESOURCE() -> u8 {
        8 // 8 bits available per resource
    }

    fn PACKING_MASK_SIZE() -> u8 {
        0xFF // max value for a u8
    }

    fn pack_resource_types(resource_types: Span<u8>) -> u128 {
        // ensure all resources can be packed into a u128
        let max_resources: u8 = Self::PACKING_TOTAL_BITS_AVAILABLE() / Self::PACKING_MAX_BITS_PER_RESOURCE();
        assert!(resource_types.len() <= max_resources.into(), "resources are too many to be packed into a u128");

        // pack the resources into a u128
        let mut produced_resources: u128 = 0;
        for resource_type in resource_types {
            // ensure resource type is not zero
            assert!((*resource_type).is_non_zero(), "resource type is zero");

            // shift left to make space for the new resource
            let masked_produced_resources = BitShift::shl(
                produced_resources, Self::PACKING_MAX_BITS_PER_RESOURCE().into(),
            );

            // add the new resource
            let new_produced_resources = masked_produced_resources | (*resource_type).into();

            // update the packed value
            produced_resources = new_produced_resources;
        };
        produced_resources
    }


    fn unpack_resource_types(mut produced_resources: u128) -> Span<u8> {
        // Iterate over each resource type
        let mut resource_types = array![];
        while produced_resources > 0 {
            // extract the first 8 bits
            let resource_type = produced_resources & Self::PACKING_MASK_SIZE().into();
            resource_types.append(resource_type.try_into().unwrap());

            // shift right by 8 bits
            produced_resources = BitShift::shr(produced_resources, Self::PACKING_MAX_BITS_PER_RESOURCE().into());
        };

        resource_types.span()
    }

    fn produces_resource(mut packed: u128, check_resource_type: u8) -> bool {
        let mut contains_resource = false;
        while packed > 0 {
            // extract the first 8 bits
            let resource_type: u8 = (packed & Self::PACKING_MASK_SIZE().into()).try_into().unwrap();
            if resource_type == check_resource_type {
                contains_resource = true;
                break;
            }
            // shift right by 8 bits
            packed = BitShift::shr(packed, Self::PACKING_MAX_BITS_PER_RESOURCE().into());
        };
        contains_resource
    }
}
