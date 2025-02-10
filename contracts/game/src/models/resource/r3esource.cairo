use core::fmt::{Display, Formatter, Error};
use core::num::traits::Bounded;

use dojo::model::{ModelStorage, Model};
use dojo::world::WorldStorage;

use s1_eternum::alias::ID;
use s1_eternum::constants::{ResourceTypes, resource_type_name};
use s1_eternum::models::config::W3eightConfig;
use s1_eternum::models::resource::production::production::{Production, ProductionImpl};
use s1_eternum::models::weight::{W3eight, W3eightImpl};
#[derive(Copy, Drop, Serde)]
pub struct SingleR33esource {
    entity_id: ID,
    resource_type: u8,
    balance: u128,
    production: Production,
    produces: bool,
}

impl SingleR33esourceDisplay of Display<SingleR33esource> {
    fn fmt(self: @SingleR33esource, ref f: Formatter) -> Result<(), Error> {
        let str: ByteArray = format!(
            "{} (id: {}, balance: {})",
            resource_type_name(*self.resource_type),
            *self.entity_id,
            *self.balance,
        );
        f.buffer.append(@str);
        Result::Ok(())
    }
}


#[generate_trait]
impl WeightStoreImpl of WeightStoreTrait {
    fn retrieve(ref world: WorldStorage, entity_id: ID) -> W3eight {
        assert!(entity_id.is_non_zero(), "entity id not found");
        R3esourceImpl::read_weight(ref world, entity_id)
    }

    fn store(ref self: W3eight, ref world: WorldStorage, entity_id: ID) {
        R3esourceImpl::write_weight(ref world, entity_id, self);
    }
}

#[generate_trait]
impl WeightUnitImpl of WeightUnitTrait {
    fn grams(ref world: WorldStorage, resource_type: u8) -> u128 {
        let unit_weight_config: W3eightConfig = world.read_model(resource_type);
        unit_weight_config.weight_gram
    }
}


#[generate_trait]
impl SingleR33esourceStoreImpl of SingleR33esourceStoreTrait {
    fn retrieve(
        ref world: WorldStorage, 
        entity_id: ID, 
        resource_type: u8, 
        ref entity_weight: W3eight, 
        unit_weight_grams: u128, 
        structure: bool)
         -> SingleR33esource {
        assert!(entity_id.is_non_zero(), "entity id not found");
        assert!(resource_type.is_non_zero(), "invalid resource specified");

        let balance: u128 
            = R3esourceImpl::read_balance(ref world, entity_id, resource_type);
        // ensure the balance is updated when entity is a structure
        let mut resource 
            = SingleR33esource { entity_id, resource_type, balance, production: Zeroable::zero(), produces: structure};
        if resource.produces  {
            let now: u32 = starknet::get_block_timestamp().try_into().unwrap();
            resource.production 
                = R3esourceImpl::read_production(ref world, entity_id, resource_type);        
            if resource.production.last_updated_at != now {
                let mut entity_weight: W3eight = WeightStoreImpl::retrieve(ref world, entity_id);

                // harvest the resource and get the amount of resources produced
                let harvest_amount: u128 = ProductionImpl::harvest(ref resource);

                // add the produced amount to the resource balance
                if harvest_amount.is_non_zero() {
                    let unit_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
                    resource.add(harvest_amount, ref entity_weight, unit_weight_grams);
                }

                // commit entity resource and weight
                resource.store(ref world);
                entity_weight.store(ref world, entity_id);
            }

        }

        return resource;
    }

    fn store(ref self: SingleR33esource, ref world: WorldStorage) {
        R3esourceImpl::write_balance(ref world, self.entity_id, self.resource_type, self.balance);
        if self.produces {
            R3esourceImpl::write_production(ref world, self.entity_id, self.resource_type, self.production);
        }
    }
}



#[generate_trait]
impl SingleR33esourceImpl of SingleR33esourceTrait {

    #[inline(always)]
    fn spend(ref self: SingleR33esource, amount: u128, ref entity_weight: W3eight, unit_weight: u128) {

        assert!(self.balance >= amount, "Insufficient Balance: {} < {}", self, amount);
        self.balance -= amount;
        entity_weight.deduct(amount * unit_weight);
        // todo add event here to show amount burnt
    }


    #[inline(always)]
    fn add(ref self: SingleR33esource, amount: u128, ref entity_weight: W3eight, unit_weight: u128) -> u128 {

        // todo: increase capacity with storehouse buildings

        let (max_storable, total_weight) 
            = Self::storable_amount(amount, entity_weight.unused(), unit_weight);

        self.balance += max_storable;
        entity_weight.add(total_weight);

        // todo add event here to show amount burnt
        max_storable
    }

    #[inline(always)]
    fn storable_amount(amount: u128, storage_left: u128, unit_weight: u128) -> (u128, u128) {
        let mut max_storable: u128 = amount;
        let mut total_weight: u128 = unit_weight * amount;
        
        if storage_left < total_weight {
            max_storable = storage_left / unit_weight;
            total_weight = max_storable * unit_weight; // ensure total weight is an exact multiple
            // todo add event here to show amount burnt storage_left % weight
        }
        
        (max_storable, total_weight)
    }


}





#[generate_trait]
impl StructureSingleR33esourceFoodImpl of StructureSingleR33esourceFoodTrait {
    fn is_food(resource_type: u8) -> bool {
        resource_type == ResourceTypes::WHEAT || resource_type == ResourceTypes::FISH
    }
}






#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct R3esource {
    #[key]
    entity_id: ID,
    // Resource Types
    STONE_BALANCE: u128,
    STONE_PRODUCTION: Production,

    COAL_BALANCE: u128,
    COAL_PRODUCTION: Production,

    WOOD_BALANCE: u128,
    WOOD_PRODUCTION: Production,

    COPPER_BALANCE: u128,
    COPPER_PRODUCTION: Production,

    IRONWOOD_BALANCE: u128,
    IRONWOOD_PRODUCTION: Production,

    OBSIDIAN_BALANCE: u128,
    OBSIDIAN_PRODUCTION: Production,

    GOLD_BALANCE: u128,
    GOLD_PRODUCTION: Production,

    SILVER_BALANCE: u128,
    SILVER_PRODUCTION: Production,

    MITHRAL_BALANCE: u128,
    MITHRAL_PRODUCTION: Production,

    ALCHEMICAL_SILVER_BALANCE: u128,
    ALCHEMICAL_SILVER_PRODUCTION: Production,

    COLD_IRON_BALANCE: u128,
    COLD_IRON_PRODUCTION: Production,

    DEEP_CRYSTAL_BALANCE: u128,
    DEEP_CRYSTAL_PRODUCTION: Production,

    RUBY_BALANCE: u128,
    RUBY_PRODUCTION: Production,

    DIAMONDS_BALANCE: u128,
    DIAMONDS_PRODUCTION: Production,

    HARTWOOD_BALANCE: u128,
    HARTWOOD_PRODUCTION: Production,

    IGNIUM_BALANCE: u128,
    IGNIUM_PRODUCTION: Production,

    TWILIGHT_QUARTZ_BALANCE: u128,
    TWILIGHT_QUARTZ_PRODUCTION: Production,

    TRUE_ICE_BALANCE: u128,
    TRUE_ICE_PRODUCTION: Production,

    ADAMANTINE_BALANCE: u128,
    ADAMANTINE_PRODUCTION: Production,

    SAPPHIRE_BALANCE: u128,
    SAPPHIRE_PRODUCTION: Production,

    ETHEREAL_SILICA_BALANCE: u128,
    ETHEREAL_SILICA_PRODUCTION: Production,

    DRAGONHIDE_BALANCE: u128,
    DRAGONHIDE_PRODUCTION: Production,

    LABOR_BALANCE: u128,
    LABOR_PRODUCTION: Production,

    EARTHEN_SHARD_BALANCE: u128,
    EARTHEN_SHARD_PRODUCTION: Production,

    DONKEY_BALANCE: u128,
    DONKEY_PRODUCTION: Production,

    KNIGHT_T1_BALANCE: u128,
    KNIGHT_T1_PRODUCTION: Production,

    KNIGHT_T2_BALANCE: u128,
    KNIGHT_T2_PRODUCTION: Production,

    KNIGHT_T3_BALANCE: u128,
    KNIGHT_T3_PRODUCTION: Production,

    CROSSBOWMAN_T1_BALANCE: u128,
    CROSSBOWMAN_T1_PRODUCTION: Production,

    CROSSBOWMAN_T2_BALANCE: u128,
    CROSSBOWMAN_T2_PRODUCTION: Production,

    CROSSBOWMAN_T3_BALANCE: u128,
    CROSSBOWMAN_T3_PRODUCTION: Production,

    PALADIN_T1_BALANCE: u128,
    PALADIN_T1_PRODUCTION: Production,

    PALADIN_T2_BALANCE: u128,
    PALADIN_T2_PRODUCTION: Production,

    PALADIN_T3_BALANCE: u128,
    PALADIN_T3_PRODUCTION: Production,

    WHEAT_BALANCE: u128,
    WHEAT_PRODUCTION: Production,

    FISH_BALANCE: u128,
    FISH_PRODUCTION: Production,

    LORDS_BALANCE: u128,
    LORDS_PRODUCTION: Production,

    weight: W3eight,
}




#[generate_trait]
impl R3esourceImpl of R3esourceTrait {

    fn read_balance(ref world: WorldStorage, entity_id: ID, resource_type: u8) -> u128 {
        return world.read_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            Self::balance_selector(resource_type.into())
        );
    }

    fn read_production(ref world: WorldStorage, entity_id: ID, resource_type: u8) -> Production {
        return world.read_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            Self::production_selector(resource_type.into())
        );
    }


    fn write_balance(ref world: WorldStorage, entity_id: ID, resource_type: u8, balance: u128) {
        world.write_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            Self::balance_selector(resource_type.into()), 
            balance
        );
    }

    fn write_production(ref world: WorldStorage, entity_id: ID, resource_type: u8, production: Production) {
        world.write_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            Self::production_selector(resource_type.into()), 
            production
        );
    }

    fn read_weight(ref world: WorldStorage, entity_id: ID) -> W3eight {
        return world.read_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            selector!("weight")
        );
    }

    fn write_weight(ref world: WorldStorage, entity_id: ID, weight: W3eight) {
        world.write_member(
            Model::<R3esource>::ptr_from_keys(entity_id), 
            selector!("weight"), 
            weight
        );
    }

    fn balance_selector(resource_type: felt252) -> felt252 {
        match resource_type {
            0 => panic!("Invalid resource type"),
            1 => selector!("STONE_BALANCE"),
            2 => selector!("COAL_BALANCE"),
            3 => selector!("WOOD_BALANCE"),
            4 => selector!("COPPER_BALANCE"),
            5 => selector!("IRONWOOD_BALANCE"),
            6 => selector!("OBSIDIAN_BALANCE"),
            7 => selector!("GOLD_BALANCE"),
            8 => selector!("SILVER_BALANCE"),
            9 => selector!("MITHRAL_BALANCE"),
            10 => selector!("ALCHEMICAL_SILVER_BALANCE"),
            11 => selector!("COLD_IRON_BALANCE"),
            12 => selector!("DEEP_CRYSTAL_BALANCE"),
            13 => selector!("RUBY_BALANCE"),
            14 => selector!("DIAMONDS_BALANCE"),
            15 => selector!("HARTWOOD_BALANCE"),
            16 => selector!("IGNIUM_BALANCE"),
            17 => selector!("TWILIGHT_QUARTZ_BALANCE"),
            18 => selector!("TRUE_ICE_BALANCE"),
            19 => selector!("ADAMANTINE_BALANCE"),
            20 => selector!("SAPPHIRE_BALANCE"),
            21 => selector!("ETHEREAL_SILICA_BALANCE"),
            22 => selector!("DRAGONHIDE_BALANCE"),
            23 => selector!("LABOR_BALANCE"),
            24 => selector!("EARTHEN_SHARD_BALANCE"),
            25 => selector!("DONKEY_BALANCE"),
            26 => selector!("KNIGHT_T1_BALANCE"),
            27 => selector!("KNIGHT_T2_BALANCE"),
            28 => selector!("KNIGHT_T3_BALANCE"),
            29 => selector!("CROSSBOWMAN_T1_BALANCE"),
            30 => selector!("CROSSBOWMAN_T2_BALANCE"),
            31 => selector!("CROSSBOWMAN_T3_BALANCE"),
            32 => selector!("PALADIN_T1_BALANCE"),
            33 => selector!("PALADIN_T2_BALANCE"),
            34 => selector!("PALADIN_T3_BALANCE"),
            35 => selector!("WHEAT_BALANCE"),
            36 => selector!("FISH_BALANCE"),
            37 => selector!("LORDS_BALANCE"),
            _ => panic!("Invalid resource type"),
        }
    }


    fn production_selector(resource_type: felt252) -> felt252 {
        match resource_type {
            0 => panic!("Invalid resource type"),
            1 => selector!("STONE_PRODUCTION"),
            2 => selector!("COAL_PRODUCTION"),
            3 => selector!("WOOD_PRODUCTION"),
            4 => selector!("COPPER_PRODUCTION"),
            5 => selector!("IRONWOOD_PRODUCTION"),
            6 => selector!("OBSIDIAN_PRODUCTION"),
            7 => selector!("GOLD_PRODUCTION"),
            8 => selector!("SILVER_PRODUCTION"),
            9 => selector!("MITHRAL_PRODUCTION"),
            10 => selector!("ALCHEMICAL_SILVER_PRODUCTION"),
            11 => selector!("COLD_IRON_PRODUCTION"),
            12 => selector!("DEEP_CRYSTAL_PRODUCTION"),
            13 => selector!("RUBY_PRODUCTION"),
            14 => selector!("DIAMONDS_PRODUCTION"),
            15 => selector!("HARTWOOD_PRODUCTION"),
            16 => selector!("IGNIUM_PRODUCTION"),   
            17 => selector!("TWILIGHT_QUARTZ_PRODUCTION"),
            18 => selector!("TRUE_ICE_PRODUCTION"),
            19 => selector!("ADAMANTINE_PRODUCTION"),
            20 => selector!("SAPPHIRE_PRODUCTION"),
            21 => selector!("ETHEREAL_SILICA_PRODUCTION"),
            22 => selector!("DRAGONHIDE_PRODUCTION"),
            23 => selector!("LABOR_PRODUCTION"),
            24 => selector!("EARTHEN_SHARD_PRODUCTION"),
            25 => selector!("DONKEY_PRODUCTION"),
            26 => selector!("KNIGHT_T1_PRODUCTION"),
            27 => selector!("KNIGHT_T2_PRODUCTION"),
            28 => selector!("KNIGHT_T3_PRODUCTION"),
            29 => selector!("CROSSBOWMAN_T1_PRODUCTION"),
            30 => selector!("CROSSBOWMAN_T2_PRODUCTION"),
            31 => selector!("CROSSBOWMAN_T3_PRODUCTION"),
            32 => selector!("PALADIN_T1_PRODUCTION"),
            33 => selector!("PALADIN_T2_PRODUCTION"),
            34 => selector!("PALADIN_T3_PRODUCTION"),
            35 => selector!("WHEAT_PRODUCTION"),
            36 => selector!("FISH_PRODUCTION"),
            37 => selector!("LORDS_PRODUCTION"),
            _ => panic!("Invalid resource type"),
        }
    }

    fn key_only(entity_id: ID) -> R3esource {
        let mut model: R3esource = Default::default();
        model.entity_id = entity_id;
        return model;
    }
}
