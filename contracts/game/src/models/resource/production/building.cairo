use alexandria_math::U128BitShift;
use core::num::traits::zero::Zero;
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
use crate::models::config::{
    BuildingCategoryConfig, BuildingConfig, CapacityConfig, ResourceFactoryConfig, TickImpl, WorldConfigUtilImpl,
};
use crate::models::events::{BuildingPaymentStory, BuildingPlacementStory, Story, StoryEvent};
use crate::models::position::Coord;
use crate::models::resource::production::production::{Production, ProductionTrait};
use crate::models::resource::resource::{
    ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl,
    WeightStoreImpl,
};
use crate::models::structure::{
    StructureBase, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureOwnerStoreImpl,
};
use crate::models::weight::{Weight, WeightImpl, WeightTrait};
use crate::utils::math::{PercentageImpl, PercentageValueImpl};
use starknet::ContractAddress;


#[derive(PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct Building {
    #[key]
    pub outer_col: u32,
    #[key]
    pub outer_row: u32,
    #[key]
    pub inner_col: u32,
    #[key]
    pub inner_row: u32,
    pub category: u8,
    pub bonus_percent: u32,
    pub entity_id: ID,
    pub outer_entity_id: ID,
    pub paused: bool,
}

#[derive(Copy, Drop, Serde, Introspect, Default)]
#[dojo::model]
pub struct StructureBuildings {
    #[key]
    pub entity_id: ID,
    // number of buildings per category in structure
    // each category takes up to 8 bits.
    // so each u128 stores 16 categories
    // and since we have 39 building categories, we need 3 u128
    pub packed_counts_1: u128,
    pub packed_counts_2: u128,
    pub packed_counts_3: u128,
    // population
    pub population: Population,
}

#[derive(Copy, Drop, Serde, Introspect, Default, DojoStore)]
pub struct Population {
    pub current: u32,
    pub max: u32,
}

#[generate_trait]
pub impl PopulationImpl of PopulationTrait {
    fn increase_population(ref self: Population, amount: u32) -> u32 {
        self.current += amount;
        self.current
    }
    fn decrease_population(ref self: Population, amount: u32) -> u32 {
        self.current -= amount;
        self.current
    }
    fn assert_within_capacity(ref self: Population, base_population: u32) {
        assert(self.max + base_population >= self.current, 'Population exceeds capacity')
    }
    fn increase_capacity(ref self: Population, amount: u32) -> u32 {
        self.max += amount;
        self.max
    }
    fn decrease_capacity(ref self: Population, amount: u32) -> u32 {
        self.max -= amount;
        self.max
    }
}


#[generate_trait]
pub impl StructureBuildingCategoryCountImpl of StructureBuildingCategoryCountTrait {
    fn _category_index(category: BuildingCategory) -> u8 {
        let category: u8 = category.into();
        assert!(category.is_non_zero(), "category must be non zero");
        (category - 1) / 16
    }

    fn building_count(self: StructureBuildings, category: BuildingCategory) -> u8 {
        let category: u8 = category.into();
        assert!(category.is_non_zero(), "category must be non zero");

        let mut count: u128 = 0;
        let packed: Array<u128> = array![self.packed_counts_1, self.packed_counts_2, self.packed_counts_3];
        let mut storage_array_index: u8 = Self::_category_index(category.into());
        for index in 0..packed.len() {
            if index != storage_array_index.into() {
                continue;
            }
            // the packed value contains the counts of all categories
            // and can take up to 8 bits for each category. so we can store
            // up to 128 / 8 = 16 categories
            let packed_value: u128 = *packed.at(index);
            let mask: u128 = 0xFF; // al 8 bits set to 1

            // Calculate the relative position within the current packed value
            // Each packed value stores 16 categories (0-15, 16-31, 32-47)
            let relative_category = (category - 1) % 16;
            let shift_amount = relative_category * 8;
            count = U128BitShift::shr(packed_value, shift_amount.into()) & mask;
            break;
        }

        count.try_into().unwrap()
    }

    fn update_building_count(ref self: StructureBuildings, category: BuildingCategory, count: u8) {
        let category: u8 = category.into();
        assert!(category.is_non_zero(), "category must be non zero");

        let packed: Array<u128> = array![self.packed_counts_1, self.packed_counts_2, self.packed_counts_3];
        let mut new_packed: Array<u128> = array![];
        let mut storage_array_index: u8 = Self::_category_index(category.into());
        for index in 0..packed.len() {
            if index != storage_array_index.into() {
                new_packed.append(*packed.at(index));
                continue;
            }
            let packed_value: u128 = *packed.at(index);
            let category_u8: u8 = category;
            // Calculate the relative position within the current packed value
            let relative_category = (category_u8 - 1) % 16;
            // Each category takes 8 bits
            let shift_amount = relative_category * 8;
            let mask: u128 = U128BitShift::shl(0xFF, shift_amount.into()); // 8 bits set to 1, shifted to position
            let shifted_count: u128 = U128BitShift::shl(count.into(), shift_amount.into());
            let new_packed_value: u128 = (packed_value & ~mask) | shifted_count;
            new_packed.append(new_packed_value);
        }
        self.packed_counts_1 = *new_packed.at(0);
        self.packed_counts_2 = *new_packed.at(1);
        self.packed_counts_3 = *new_packed.at(2);
    }
}

#[derive(PartialEq, Copy, Drop, Serde, Introspect)]
pub enum BuildingCategory {
    None,
    // Non Resource Buildings
    WorkersHut,
    Storehouse,
    // Resource Buildings
    ResourceStone,
    ResourceCoal,
    ResourceWood,
    ResourceCopper,
    ResourceIronwood,
    ResourceObsidian,
    ResourceGold,
    ResourceSilver,
    ResourceMithral,
    ResourceAlchemicalSilver,
    ResourceColdIron,
    ResourceDeepCrystal,
    ResourceRuby,
    ResourceDiamonds,
    ResourceHartwood,
    ResourceIgnium,
    ResourceTwilightQuartz,
    ResourceTrueIce,
    ResourceAdamantine,
    ResourceSapphire,
    ResourceEtherealSilica,
    ResourceDragonhide,
    ResourceLabor,
    ResourceEarthenShard,
    ResourceDonkey,
    ResourceKnightT1,
    ResourceKnightT2,
    ResourceKnightT3,
    ResourceCrossbowmanT1,
    ResourceCrossbowmanT2,
    ResourceCrossbowmanT3,
    ResourcePaladinT1,
    ResourcePaladinT2,
    ResourcePaladinT3,
    ResourceWheat,
    ResourceFish,
    ResourceEssence,
}

const LAST_RESOURCE_BUILDING: u8 = 39;
pub impl BuildingCategoryIntoFelt252 of Into<BuildingCategory, felt252> {
    fn into(self: BuildingCategory) -> felt252 {
        match self {
            // Non Resource Buildings
            BuildingCategory::None => 0,
            BuildingCategory::WorkersHut => 1,
            BuildingCategory::Storehouse => 2,
            // Resource Buildings
            BuildingCategory::ResourceStone => 3,
            BuildingCategory::ResourceCoal => 4,
            BuildingCategory::ResourceWood => 5,
            BuildingCategory::ResourceCopper => 6,
            BuildingCategory::ResourceIronwood => 7,
            BuildingCategory::ResourceObsidian => 8,
            BuildingCategory::ResourceGold => 9,
            BuildingCategory::ResourceSilver => 10,
            BuildingCategory::ResourceMithral => 11,
            BuildingCategory::ResourceAlchemicalSilver => 12,
            BuildingCategory::ResourceColdIron => 13,
            BuildingCategory::ResourceDeepCrystal => 14,
            BuildingCategory::ResourceRuby => 15,
            BuildingCategory::ResourceDiamonds => 16,
            BuildingCategory::ResourceHartwood => 17,
            BuildingCategory::ResourceIgnium => 18,
            BuildingCategory::ResourceTwilightQuartz => 19,
            BuildingCategory::ResourceTrueIce => 20,
            BuildingCategory::ResourceAdamantine => 21,
            BuildingCategory::ResourceSapphire => 22,
            BuildingCategory::ResourceEtherealSilica => 23,
            BuildingCategory::ResourceDragonhide => 24,
            BuildingCategory::ResourceLabor => 25,
            BuildingCategory::ResourceEarthenShard => 26,
            BuildingCategory::ResourceDonkey => 27,
            BuildingCategory::ResourceKnightT1 => 28,
            BuildingCategory::ResourceKnightT2 => 29,
            BuildingCategory::ResourceKnightT3 => 30,
            BuildingCategory::ResourceCrossbowmanT1 => 31,
            BuildingCategory::ResourceCrossbowmanT2 => 32,
            BuildingCategory::ResourceCrossbowmanT3 => 33,
            BuildingCategory::ResourcePaladinT1 => 34,
            BuildingCategory::ResourcePaladinT2 => 35,
            BuildingCategory::ResourcePaladinT3 => 36,
            BuildingCategory::ResourceWheat => 37,
            BuildingCategory::ResourceFish => 38,
            BuildingCategory::ResourceEssence => LAST_RESOURCE_BUILDING.into(),
        }
    }
}

pub impl BuildingCategoryIntoU8 of Into<BuildingCategory, u8> {
    fn into(self: BuildingCategory) -> u8 {
        let category_felt: felt252 = self.into();
        let category: u8 = category_felt.try_into().unwrap();
        category
    }
}


// todo: verify enum is correct values are
pub impl BuildingCategoryFromU8 of Into<u8, BuildingCategory> {
    fn into(self: u8) -> BuildingCategory {
        match self {
            0 => BuildingCategory::None,
            1 => BuildingCategory::WorkersHut,
            2 => BuildingCategory::Storehouse,
            3 => BuildingCategory::ResourceStone,
            4 => BuildingCategory::ResourceCoal,
            5 => BuildingCategory::ResourceWood,
            6 => BuildingCategory::ResourceCopper,
            7 => BuildingCategory::ResourceIronwood,
            8 => BuildingCategory::ResourceObsidian,
            9 => BuildingCategory::ResourceGold,
            10 => BuildingCategory::ResourceSilver,
            11 => BuildingCategory::ResourceMithral,
            12 => BuildingCategory::ResourceAlchemicalSilver,
            13 => BuildingCategory::ResourceColdIron,
            14 => BuildingCategory::ResourceDeepCrystal,
            15 => BuildingCategory::ResourceRuby,
            16 => BuildingCategory::ResourceDiamonds,
            17 => BuildingCategory::ResourceHartwood,
            18 => BuildingCategory::ResourceIgnium,
            19 => BuildingCategory::ResourceTwilightQuartz,
            20 => BuildingCategory::ResourceTrueIce,
            21 => BuildingCategory::ResourceAdamantine,
            22 => BuildingCategory::ResourceSapphire,
            23 => BuildingCategory::ResourceEtherealSilica,
            24 => BuildingCategory::ResourceDragonhide,
            25 => BuildingCategory::ResourceLabor,
            26 => BuildingCategory::ResourceEarthenShard,
            27 => BuildingCategory::ResourceDonkey,
            28 => BuildingCategory::ResourceKnightT1,
            29 => BuildingCategory::ResourceKnightT2,
            30 => BuildingCategory::ResourceKnightT3,
            31 => BuildingCategory::ResourceCrossbowmanT1,
            32 => BuildingCategory::ResourceCrossbowmanT2,
            33 => BuildingCategory::ResourceCrossbowmanT3,
            34 => BuildingCategory::ResourcePaladinT1,
            35 => BuildingCategory::ResourcePaladinT2,
            36 => BuildingCategory::ResourcePaladinT3,
            37 => BuildingCategory::ResourceWheat,
            38 => BuildingCategory::ResourceFish,
            39 => BuildingCategory::ResourceEssence,
            _ => BuildingCategory::None,
        }
    }
}

#[generate_trait]
pub impl BuildingPerksImpl of BuildingPerksTrait {
    fn grant_capacity_bonus(self: Building, ref world: WorldStorage, add: bool) {
        if self._is_storage_capacity_booster() {
            self._boost_storage_capacity(ref world, add);
        }

        if self._is_explorer_capacity_booster() {
            self._boost_explorer_capacity(ref world, add);
        }
    }

    fn _is_storage_capacity_booster(self: Building) -> bool {
        let category: BuildingCategory = self.category.into();
        match category {
            BuildingCategory::Storehouse => true,
            _ => false,
        }
    }

    fn _is_explorer_capacity_booster(self: Building) -> bool {
        let category: BuildingCategory = self.category.into();
        match category {
            BuildingCategory::ResourceKnightT1 => true,
            BuildingCategory::ResourceKnightT2 => true,
            BuildingCategory::ResourceKnightT3 => true,
            BuildingCategory::ResourceCrossbowmanT1 => true,
            BuildingCategory::ResourceCrossbowmanT2 => true,
            BuildingCategory::ResourceCrossbowmanT3 => true,
            BuildingCategory::ResourcePaladinT1 => true,
            BuildingCategory::ResourcePaladinT2 => true,
            BuildingCategory::ResourcePaladinT3 => true,
            _ => false,
        }
    }

    fn _boost_storage_capacity(self: Building, ref world: WorldStorage, add: bool) {
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.storehouse_boost_capacity.into() * RESOURCE_PRECISION;
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);
        if add {
            structure_weight.add_capacity(capacity);
        } else {
            structure_weight.deduct_capacity(capacity, false);
        }
        structure_weight.store(ref world, self.outer_entity_id);
    }

    fn _boost_explorer_capacity(self: Building, ref world: WorldStorage, add: bool) {
        let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, self.outer_entity_id);
        if add {
            structure_base.troop_max_explorer_count += 1;
        } else {
            structure_base.troop_max_explorer_count -= 1;

            // ensure explorer count does not exceed troop capacity
            assert!(
                structure_base.troop_explorer_count <= structure_base.troop_max_explorer_count,
                "delete an explorer troop unit before removing this building",
            );
        }
        StructureBaseStoreImpl::store(ref structure_base, ref world, self.outer_entity_id);
    }
}

#[generate_trait]
pub impl BuildingProductionImpl of BuildingProductionTrait {
    fn is_resource_producer(self: Building) -> bool {
        self.produced_resource().is_non_zero()
    }

    fn allowed_for_all_realms_and_villages(self: Building) -> bool {
        let category: BuildingCategory = self.category.into();
        match category {
            BuildingCategory::None => false,
            BuildingCategory::WorkersHut => true,
            BuildingCategory::Storehouse => true,
            BuildingCategory::ResourceStone => false,
            BuildingCategory::ResourceCoal => false,
            BuildingCategory::ResourceWood => false,
            BuildingCategory::ResourceCopper => false,
            BuildingCategory::ResourceIronwood => false,
            BuildingCategory::ResourceObsidian => false,
            BuildingCategory::ResourceGold => false,
            BuildingCategory::ResourceSilver => false,
            BuildingCategory::ResourceMithral => false,
            BuildingCategory::ResourceAlchemicalSilver => false,
            BuildingCategory::ResourceColdIron => false,
            BuildingCategory::ResourceDeepCrystal => false,
            BuildingCategory::ResourceRuby => false,
            BuildingCategory::ResourceDiamonds => false,
            BuildingCategory::ResourceHartwood => false,
            BuildingCategory::ResourceIgnium => false,
            BuildingCategory::ResourceTwilightQuartz => false,
            BuildingCategory::ResourceTrueIce => false,
            BuildingCategory::ResourceAdamantine => false,
            BuildingCategory::ResourceSapphire => false,
            BuildingCategory::ResourceEtherealSilica => false,
            BuildingCategory::ResourceDragonhide => false,
            BuildingCategory::ResourceLabor => false,
            BuildingCategory::ResourceEarthenShard => false,
            BuildingCategory::ResourceDonkey => true,
            BuildingCategory::ResourceKnightT1 => true,
            BuildingCategory::ResourceKnightT2 => true,
            BuildingCategory::ResourceKnightT3 => true,
            BuildingCategory::ResourceCrossbowmanT1 => true,
            BuildingCategory::ResourceCrossbowmanT2 => true,
            BuildingCategory::ResourceCrossbowmanT3 => true,
            BuildingCategory::ResourcePaladinT1 => true,
            BuildingCategory::ResourcePaladinT2 => true,
            BuildingCategory::ResourcePaladinT3 => true,
            BuildingCategory::ResourceWheat => true,
            BuildingCategory::ResourceFish => true,
            BuildingCategory::ResourceEssence => true,
            //  NEVER ALLOW LORDS TO BE BUILT
        }
    }

    fn produced_resource(self: Building) -> u8 {
        let category: BuildingCategory = self.category.into();
        match category {
            BuildingCategory::None => 0,
            BuildingCategory::WorkersHut => 0,
            BuildingCategory::Storehouse => 0,
            BuildingCategory::ResourceStone => ResourceTypes::STONE,
            BuildingCategory::ResourceCoal => ResourceTypes::COAL,
            BuildingCategory::ResourceWood => ResourceTypes::WOOD,
            BuildingCategory::ResourceCopper => ResourceTypes::COPPER,
            BuildingCategory::ResourceIronwood => ResourceTypes::IRONWOOD,
            BuildingCategory::ResourceObsidian => ResourceTypes::OBSIDIAN,
            BuildingCategory::ResourceGold => ResourceTypes::GOLD,
            BuildingCategory::ResourceSilver => ResourceTypes::SILVER,
            BuildingCategory::ResourceMithral => ResourceTypes::MITHRAL,
            BuildingCategory::ResourceAlchemicalSilver => ResourceTypes::ALCHEMICAL_SILVER,
            BuildingCategory::ResourceColdIron => ResourceTypes::COLD_IRON,
            BuildingCategory::ResourceDeepCrystal => ResourceTypes::DEEP_CRYSTAL,
            BuildingCategory::ResourceRuby => ResourceTypes::RUBY,
            BuildingCategory::ResourceDiamonds => ResourceTypes::DIAMONDS,
            BuildingCategory::ResourceHartwood => ResourceTypes::HARTWOOD,
            BuildingCategory::ResourceIgnium => ResourceTypes::IGNIUM,
            BuildingCategory::ResourceTwilightQuartz => ResourceTypes::TWILIGHT_QUARTZ,
            BuildingCategory::ResourceTrueIce => ResourceTypes::TRUE_ICE,
            BuildingCategory::ResourceAdamantine => ResourceTypes::ADAMANTINE,
            BuildingCategory::ResourceSapphire => ResourceTypes::SAPPHIRE,
            BuildingCategory::ResourceEtherealSilica => ResourceTypes::ETHEREAL_SILICA,
            BuildingCategory::ResourceDragonhide => ResourceTypes::DRAGONHIDE,
            BuildingCategory::ResourceLabor => ResourceTypes::LABOR,
            BuildingCategory::ResourceEarthenShard => ResourceTypes::EARTHEN_SHARD,
            BuildingCategory::ResourceDonkey => ResourceTypes::DONKEY,
            BuildingCategory::ResourceKnightT1 => ResourceTypes::KNIGHT_T1,
            BuildingCategory::ResourceKnightT2 => ResourceTypes::KNIGHT_T2,
            BuildingCategory::ResourceKnightT3 => ResourceTypes::KNIGHT_T3,
            BuildingCategory::ResourceCrossbowmanT1 => ResourceTypes::CROSSBOWMAN_T1,
            BuildingCategory::ResourceCrossbowmanT2 => ResourceTypes::CROSSBOWMAN_T2,
            BuildingCategory::ResourceCrossbowmanT3 => ResourceTypes::CROSSBOWMAN_T3,
            BuildingCategory::ResourcePaladinT1 => ResourceTypes::PALADIN_T1,
            BuildingCategory::ResourcePaladinT2 => ResourceTypes::PALADIN_T2,
            BuildingCategory::ResourcePaladinT3 => ResourceTypes::PALADIN_T3,
            BuildingCategory::ResourceWheat => ResourceTypes::WHEAT,
            BuildingCategory::ResourceFish => ResourceTypes::FISH,
            BuildingCategory::ResourceEssence => ResourceTypes::ESSENCE,
            //  NEVER ALLOW LORDS TO BE BUILT
        }
    }

    fn update_production(
        ref self: Building, ref world: WorldStorage, structure_category: u8, ref structure_weight: Weight, stop: bool,
    ) {
        // update produced resource balance before updating production
        let produced_resource_type = self.produced_resource();
        let produced_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleResourceStoreImpl::retrieve(
            ref world,
            self.outer_entity_id,
            produced_resource_type,
            ref structure_weight,
            produced_resource_weight_grams,
            true,
        );

        let mut production: Production = produced_resource.production;

        match stop {
            true => {
                // ensure production amount is gotten BEFORE updating
                // bonus received percent so production rate is decreased correctly
                let produced_amount_every_second = self.produced_amount_every_second(structure_category, ref world);

                // decrease building count
                production.decrease_building_count();

                // decrease production rate
                production.decrease_production_rate(produced_amount_every_second.try_into().unwrap());
            },
            false => {
                // ensure production amount is gotten AFTER updating
                // bonus received percent so production rate is increased correctly
                let produced_amount_every_second = self.produced_amount_every_second(structure_category, ref world);
                assert!(produced_amount_every_second.is_non_zero(), "resource cannot be produced");

                // increase building count
                production.increase_building_count();

                // increase production rate
                production.increase_production_rate(produced_amount_every_second.try_into().unwrap());
            },
        }
        // save production
        produced_resource.production = production;
        produced_resource.store(ref world);
        // todo add event here
    }


    fn start_production(ref self: Building, ref world: WorldStorage, structure_category: u8) {
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);

        if self.is_resource_producer() {
            self.update_production(ref world, structure_category, ref structure_weight, stop: false);
        }

        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);

        // update building
        world.write_model(@self);
    }


    fn stop_production(ref self: Building, ref world: WorldStorage, structure_category: u8) {
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);

        if self.is_resource_producer() {
            self.update_production(ref world, structure_category, ref structure_weight, stop: true);
        }

        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);

        // update building
        world.write_model(@self);
    }

    fn produced_amount_every_second(self: @Building, structure_category: u8, ref world: WorldStorage) -> u128 {
        if (*self).exists() == false {
            return 0;
        }

        let produced_resource_type = (*self).produced_resource();
        let resource_factory_config: ResourceFactoryConfig = world.read_model(produced_resource_type);
        let produced_amount_every_second: u128 = if structure_category == StructureCategory::Village.into() {
            resource_factory_config.village_output_per_second.into()
        } else {
            resource_factory_config.realm_output_per_second.into()
        };

        produced_amount_every_second
    }
}

#[generate_trait]
pub impl BuildingImpl of BuildingTrait {
    fn center() -> Coord {
        Coord { alt: false, x: 10, y: 10 }
    }

    /// Create a new building on a structure
    ///
    fn create(
        ref world: WorldStorage,
        outer_entity_owner_address: ContractAddress,
        outer_entity_id: ID,
        outer_structure_category: u8,
        outer_entity_coord: Coord,
        category: BuildingCategory,
        inner_coord: Coord,
    ) -> (Building, u8) {
        // ensure category is not None
        assert!(category != BuildingCategory::None, "category cannot be None");
        assert!(category.into() <= LAST_RESOURCE_BUILDING, "category is out of bounds");

        // ensure that building is not occupied
        let mut building: Building = world
            .read_model((outer_entity_coord.x, outer_entity_coord.y, inner_coord.x, inner_coord.y));

        assert!(!building.exists(), "space is occupied");

        // set building
        building.entity_id = world.dispatcher.uuid();
        building.category = category.into();
        building.outer_entity_id = outer_entity_id;
        world.write_model(@building);

        // start production related to building
        building.start_production(ref world, outer_structure_category);

        // give capacity bonus
        building.grant_capacity_bonus(ref world, true);

        // increase building type count for structure
        let mut structure_buildings: StructureBuildings = world.read_model(outer_entity_id);
        let building_category_count: u8 = structure_buildings.building_count(category) + 1;
        structure_buildings.update_building_count(category, building_category_count);

        // increase population
        let mut population: Population = structure_buildings.population;
        let building_category_config: BuildingCategoryConfig = world.read_model(category);

        // increase population
        let building_config: BuildingConfig = WorldConfigUtilImpl::get_member(world, selector!("building_config"));
        population.increase_population(building_category_config.population_cost.into());
        population.increase_capacity(building_category_config.capacity_grant.into());
        population.assert_within_capacity(building_config.base_population);

        // set population
        structure_buildings.population = population;
        world.write_model(@structure_buildings);

        // emit event
        world
            .emit_event(
                @StoryEvent {
                    owner: Option::Some(outer_entity_owner_address),
                    entity_id: Option::Some(outer_entity_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::BuildingPlacementStory(
                        BuildingPlacementStory {
                            inner_coord,
                            category: category.into(),
                            created: true,
                            paused: false,
                            unpaused: false,
                            destroyed: false,
                        },
                    ),
                    timestamp: starknet::get_block_timestamp(),
                },
            );

        (building, building_category_count)
    }

    /// Pause building production without removing the building
    ///
    /// When you pause production, the building stops producing resources,
    /// stops consuming resources, stops giving bonuses to adjacent buildings,
    /// and stops receiving bonuses from adjacent buildings.
    ///
    fn pause_production(
        ref world: WorldStorage,
        outer_entity_owner_address: ContractAddress,
        outer_entity_id: ID,
        outer_structure_category: u8,
        outer_entity_coord: Coord,
        inner_coord: Coord,
    ) {
        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_coord.x, outer_entity_coord.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");
        assert!(building.paused == false, "building production is already paused");

        // stop building production
        building.stop_production(ref world, outer_structure_category);
        building.paused = true;
        world.write_model(@building);

        // emit event
        world
            .emit_event(
                @StoryEvent {
                    owner: Option::Some(outer_entity_owner_address),
                    entity_id: Option::Some(outer_entity_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::BuildingPlacementStory(
                        BuildingPlacementStory {
                            inner_coord,
                            category: building.category.into(),
                            created: false,
                            paused: true,
                            unpaused: false,
                            destroyed: false,
                        },
                    ),
                    timestamp: starknet::get_block_timestamp(),
                },
            );
    }

    /// Restart building production without removing the building
    ///
    /// When you restart production, the building resumes producing resources,
    /// resumes giving bonuses to adjacent buildings, and resumes consuming resources.
    ///
    fn resume_production(
        ref world: WorldStorage,
        outer_entity_owner_address: ContractAddress,
        outer_entity_id: ID,
        outer_structure_category: u8,
        outer_entity_coord: Coord,
        inner_coord: Coord,
    ) {
        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_coord.x, outer_entity_coord.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");

        assert!(building.exists(), "building is not active");
        assert!(building.paused, "building production is not paused");

        // restart building production
        building.start_production(ref world, outer_structure_category);
        building.paused = false;
        world.write_model(@building);

        // emit event
        world
            .emit_event(
                @StoryEvent {
                    owner: Option::Some(outer_entity_owner_address),
                    entity_id: Option::Some(outer_entity_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::BuildingPlacementStory(
                        BuildingPlacementStory {
                            inner_coord,
                            category: building.category.into(),
                            created: false,
                            paused: false,
                            unpaused: true,
                            destroyed: false,
                        },
                    ),
                    timestamp: starknet::get_block_timestamp(),
                },
            );
    }

    /// Destroy building and remove it from the structure
    ///
    fn destroy(
        ref world: WorldStorage,
        outer_entity_owner_address: ContractAddress,
        outer_entity_id: ID,
        outer_structure_category: u8,
        outer_entity_coord: Coord,
        inner_coord: Coord,
    ) -> BuildingCategory {
        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_coord.x, outer_entity_coord.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");

        // ensure labor building can't be destroyed
        assert!(building.category.into() != BuildingCategory::ResourceLabor, "labor building can't be destroyed");

        // stop production related to building
        if !building.paused {
            building.stop_production(ref world, outer_structure_category);
        }

        // remove granted capacity bonus
        building.grant_capacity_bonus(ref world, false);

        // decrease building type count for realm
        let mut structure_buildings: StructureBuildings = world.read_model(outer_entity_id);
        let building_category_count: u8 = structure_buildings.building_count(building.category.into()) - 1;
        structure_buildings.update_building_count(building.category.into(), building_category_count);

        // decrease population
        let mut population: Population = structure_buildings.population;
        let building_category_config: BuildingCategoryConfig = world.read_model(building.category);
        let building_config: BuildingConfig = WorldConfigUtilImpl::get_member(world, selector!("building_config"));
        population.decrease_capacity(building_category_config.capacity_grant.into());
        population.decrease_population(building_category_config.population_cost.into());
        population.assert_within_capacity(building_config.base_population);

        // set population
        structure_buildings.population = population;
        world.write_model(@structure_buildings);

        let destroyed_building_category = building.category;

        // remove building
        world.erase_model(@building);

        // emit event
        world
            .emit_event(
                @StoryEvent {
                    owner: Option::Some(outer_entity_owner_address),
                    entity_id: Option::Some(outer_entity_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::BuildingPlacementStory(
                        BuildingPlacementStory {
                            inner_coord,
                            category: destroyed_building_category,
                            created: false,
                            paused: false,
                            unpaused: false,
                            destroyed: true,
                        },
                    ),
                    timestamp: starknet::get_block_timestamp(),
                },
            );

        destroyed_building_category.into()
    }

    fn make_payment(
        self: Building,
        building_owner_address: ContractAddress,
        building_count: u8,
        ref world: WorldStorage,
        use_simple: bool,
    ) {
        let building_category_config: BuildingCategoryConfig = world.read_model(self.category);
        let building_config: BuildingConfig = WorldConfigUtilImpl::get_member(world, selector!("building_config"));
        let mut index = 0;
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);
        let mut erection_cost_id = building_category_config.complex_erection_cost_id;
        let mut erection_cost_count = building_category_config.complex_erection_cost_count;
        if use_simple {
            erection_cost_id = building_category_config.simple_erection_cost_id;
            erection_cost_count = building_category_config.simple_erection_cost_count;
        }
        assert!(erection_cost_count.is_non_zero(), "no cost set for creating building");

        let mut tcost = array![];
        loop {
            if index == erection_cost_count {
                break;
            }
            let erection_cost: ResourceList = world.read_model((erection_cost_id, index));
            let resource_amount = Self::_erection_cost_scaled(
                building_count, erection_cost, building_config.base_cost_percent_increase.into(),
            );
            assert!(resource_amount.is_non_zero(), "zero amount cost for building creation");

            // spend resource
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, erection_cost.resource_type);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world,
                self.outer_entity_id,
                erection_cost.resource_type,
                ref structure_weight,
                resource_weight_grams,
                true,
            );
            resource.spend(resource_amount, ref structure_weight, resource_weight_grams);
            resource.store(ref world);

            tcost.append((erection_cost.resource_type, resource_amount));
            index += 1;
        }

        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);

        // emit event
        world
            .emit_event(
                @StoryEvent {
                    owner: Option::Some(building_owner_address),
                    entity_id: Option::Some(self.outer_entity_id),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::BuildingPaymentStory(
                        BuildingPaymentStory {
                            inner_coord: Coord { alt: false, x: self.inner_col, y: self.inner_row },
                            category: self.category,
                            cost: tcost.span(),
                        },
                    ),
                    timestamp: starknet::get_block_timestamp(),
                },
            );
    }

    fn _erection_cost_scaled(building_count: u8, erection_cost: ResourceList, base_cost_percent_increase: u64) -> u128 {
        // calculate cost of building based on the formula:
        // Cost = Base + (Base * Rate * (N - 1)²)
        // Where:
        //  Base = The cost of the first building
        //  Rate = How quickly the cost goes up (a small number like 0.1 or 0.2)
        //  N = Which number building this is (1st, 2nd, 3rd, etc.)
        //
        let percentage_additional_cost = PercentageImpl::get(erection_cost.amount, base_cost_percent_increase.into());
        let scale_factor = building_count - 1;
        let total_cost = erection_cost.amount
            + (scale_factor.into() * scale_factor.into() * percentage_additional_cost);
        return total_cost;
    }

    fn exists(self: Building) -> bool {
        self.entity_id.is_non_zero()
    }
}
