use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

#[derive(Copy, Drop, Serde)]
struct BankCreateParams {
    name: felt252,
    coord: Coord,
}

#[starknet::interface]
pub trait IBankSystems<T> {
    fn create_banks(ref self: T, banks: Span<BankCreateParams>) -> Span<ID>;
}

#[dojo::contract]
pub mod bank_systems {
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{
        DEFAULT_NS, REGIONAL_BANK_FIVE_ID, REGIONAL_BANK_FOUR_ID, REGIONAL_BANK_ONE_ID, REGIONAL_BANK_SIX_ID,
        REGIONAL_BANK_THREE_ID, REGIONAL_BANK_TWO_ID,
    };
    use s1_eternum::models::config::{CombatConfigImpl, TickImpl};
    use s1_eternum::models::config::{WorldConfigUtilImpl};
    use s1_eternum::models::map::{TileOccupier};
    use s1_eternum::models::name::AddressName;
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{StructureCategory, StructureImpl, StructureOwnerStoreImpl};
    use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};
    use s1_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};
    use s1_eternum::systems::utils::structure::{iStructureImpl};
    use s1_eternum::systems::utils::troop::iMercenariesImpl;

    const MAX_BANK_COUNT: u8 = 6;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_banks(ref self: ContractState, banks: Span<super::BankCreateParams>) -> Span<ID> {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure caller is game admin
            assert_caller_is_admin(world);

            // ensure only `max bank count` banks can be created and they are created at once;
            assert!(banks.len() == MAX_BANK_COUNT.into(), "cannot create more than {} banks", MAX_BANK_COUNT);

            let caller = starknet::get_caller_address();
            let mut bank_ids = array![
                REGIONAL_BANK_ONE_ID,
                REGIONAL_BANK_TWO_ID,
                REGIONAL_BANK_THREE_ID,
                REGIONAL_BANK_FOUR_ID,
                REGIONAL_BANK_FIVE_ID,
                REGIONAL_BANK_SIX_ID,
            ];
            for bank in banks {
                // create the bank structure
                let bank_entity_id = bank_ids.pop_front().unwrap();
                iStructureImpl::create(
                    ref world,
                    *bank.coord,
                    caller,
                    bank_entity_id,
                    StructureCategory::Bank,
                    array![].span(),
                    Default::default(),
                    TileOccupier::Bank,
                    false,
                );

                // save bank name model
                world.write_model(@AddressName { address: bank_entity_id.into(), name: *bank.name });

                // add guards to all 4 slots of the structure
                let troop_limit_config = CombatConfigImpl::troop_limit_config(ref world);
                let troop_stamina_config = CombatConfigImpl::troop_stamina_config(ref world);
                let tick = TickImpl::get_tick_interval(ref world);
                let seed = 'what could possibly go wrong'.into() - bank_entity_id.into();

                let guard_slots = array![GuardSlot::Delta, GuardSlot::Charlie, GuardSlot::Bravo];
                let guard_troop_types_order = array![TroopType::Paladin, TroopType::Knight, TroopType::Crossbowman];
                let mut count = 0;
                for guard_slot in guard_slots {
                    iMercenariesImpl::add(
                        ref world,
                        bank_entity_id,
                        seed + count.into(),
                        array![(guard_slot, TroopTier::T2, *guard_troop_types_order.at(count))].span(),
                        troop_limit_config,
                        troop_stamina_config,
                        tick,
                    );
                    count += 1;
                };

                bank_ids.append(bank_entity_id);
            };

            bank_ids.span()
        }
    }
}
