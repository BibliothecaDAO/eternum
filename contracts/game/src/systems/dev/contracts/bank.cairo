use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

#[starknet::interface]
pub trait IBankSystems<T> {
    fn create_admin_bank(
        ref self: T,
        name: felt252,
        coord: Coord,
        owner_fee_num: u128,
        owner_fee_denom: u128,
        owner_bridge_fee_dpt_percent: u16,
        owner_bridge_fee_wtdr_percent: u16,
    ) -> ID;
}

#[dojo::contract]
pub mod dev_bank_systems {
    use core::traits::Into;
    use dojo::model::ModelStorage;

    use dojo::world::{WorldStorage};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::bank::bank::{Bank};
    use s1_eternum::models::config::{CombatConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::name::AddressName;
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::structure::{StructureCategory, StructureImpl};
    use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
    use s1_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};
    use s1_eternum::systems::utils::map::iMapImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;

    use s1_eternum::systems::utils::troop::iMercenariesImpl;

    pub const ADMIN_BANK_ACCOUNT_ENTITY_ID: ID = 999999999;
    pub const ADMIN_BANK_ENTITY_ID: ID = 999999998;

    #[abi(embed_v0)]
    pub impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_admin_bank(
            ref self: ContractState,
            name: felt252,
            coord: Coord,
            owner_fee_num: u128,
            owner_fee_denom: u128,
            owner_bridge_fee_dpt_percent: u16,
            owner_bridge_fee_wtdr_percent: u16,
        ) -> ID {
            // ensure caller is admin
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            // create the bank structure
            iStructureImpl::create(
                ref world, coord, starknet::get_caller_address(), ADMIN_BANK_ENTITY_ID, StructureCategory::Bank, false,
            );

            // save bank name
            world.write_model(@AddressName { address: ADMIN_BANK_ENTITY_ID.try_into().unwrap(), name });

            world
                .write_model(
                    @Bank {
                        entity_id: ADMIN_BANK_ENTITY_ID,
                        owner_fee_num,
                        owner_fee_denom,
                        owner_bridge_fee_dpt_percent,
                        owner_bridge_fee_wtdr_percent,
                        exists: true,
                    },
                );

            // add guards to structure
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            // slot must start from delta, to charlie, to beta, to alpha
            let slot_tiers = array![(GuardSlot::Delta, TroopTier::T3, TroopType::Paladin)].span();
            let tick = TickImpl::get_tick_config(ref world);
            let seed = 'JUPITERJUPITER'.into() - starknet::get_block_timestamp().into();
            iMercenariesImpl::add(
                ref world,
                ADMIN_BANK_ENTITY_ID,
                seed,
                slot_tiers,
                troop_limit_config,
                troop_stamina_config,
                tick.current(),
            );

            ADMIN_BANK_ENTITY_ID
        }
    }
}
