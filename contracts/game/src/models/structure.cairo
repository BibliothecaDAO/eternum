use core::num::traits::zero::Zero;
use core::traits::Into;
use dojo::{model::{Model, ModelStorage}, world::WorldStorage};

use s1_eternum::alias::ID;
use s1_eternum::models::config::{BattleConfig, TickConfig};
use s1_eternum::models::config::{TickTrait};
use s1_eternum::models::position::Coord;
use s1_eternum::models::stamina::Stamina;
use s1_eternum::models::troop::{GuardTroops, TroopTier, TroopType, Troops};
use starknet::ContractAddress;


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
}

#[generate_trait]
pub impl StructureOwnerStoreImpl of StructureOwnerStoreTrait {
    fn retrieve(ref world: WorldStorage, structure_id: ID) -> ContractAddress {
        let owner = world.read_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("owner"));
        return owner;
    }

    fn store(ref owner: ContractAddress, ref world: WorldStorage, structure_id: ID) {
        world.write_member(Model::<Structure>::ptr_from_keys(structure_id), selector!("owner"), owner);
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
}


#[generate_trait]
pub impl StructureBaseImpl of StructureBaseTrait {
    fn assert_exists(self: StructureBase) {
        assert!(self.exists(), "entity is not a structure")
    }

    fn assert_not_cloaked(self: StructureBase, battle_config: BattleConfig, tick_config: TickConfig) {
        let (is_cloaked, reason) = self.is_cloaked(battle_config, tick_config);
        assert!(!is_cloaked, "{}", reason);
    }

    fn coord(self: StructureBase) -> Coord {
        return Coord { x: self.coord_x, y: self.coord_y };
    }

    fn exists(self: StructureBase) -> bool {
        self.category != StructureCategory::None.into()
    }

    fn is_cloaked(self: StructureBase, battle_config: BattleConfig, tick_config: TickConfig) -> (bool, ByteArray) {
        // Fragment mines have no immunity
        if self.category == StructureCategory::FragmentMine.into() {
            return (false, "");
        }

        let current_tick = tick_config.current();
        let mut allow_attack_tick: u64 = 0;
        if self.category == StructureCategory::Hyperstructure.into() {
            allow_attack_tick = tick_config.at(self.created_at.into())
                + battle_config.hyperstructure_immunity_ticks.into();
        } else {
            allow_attack_tick = tick_config.at(self.created_at.into()) + battle_config.regular_immunity_ticks.into();
        }

        if current_tick < allow_attack_tick {
            let remaining_ticks = allow_attack_tick - current_tick;
            return (
                true,
                format!("structure and related entities cannot be attacked for another {} ticks", remaining_ticks),
            );
        }

        return (false, "");
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
pub impl StructureImpl of StructureTrait {
    fn default() -> Structure {
        let troops: Troops = Troops {
            category: TroopType::Knight, tier: TroopTier::T1, count: 0, stamina: Stamina { amount: 0, updated_tick: 0 },
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
        }
    }

    fn new(entity_id: ID, category: StructureCategory, coord: Coord, owner: ContractAddress) -> Structure {
        assert!(category != StructureCategory::None, "category cannot be none");
        let mut structure: Structure = Self::default();
        structure.entity_id = entity_id;
        structure.base.category = category.into();
        structure.base.coord_x = coord.x;
        structure.base.coord_y = coord.y;
        structure.owner = owner;

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
}

pub impl StructureCategoryIntoFelt252 of Into<StructureCategory, felt252> {
    fn into(self: StructureCategory) -> felt252 {
        match self {
            StructureCategory::None => 0,
            StructureCategory::Realm => 1,
            StructureCategory::Hyperstructure => 2,
            StructureCategory::Bank => 3,
            StructureCategory::FragmentMine => 4,
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
        }
    }
}
