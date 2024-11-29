use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;
use s0_eternum::models::position::{Coord};

#[starknet::interface]
trait IBankSystems<T> {
    fn create_bank(
        ref self: T,
        realm_entity_id: ID,
        coord: Coord,
        owner_fee_num: u128,
        owner_fee_denom: u128,
        owner_bridge_fee_dpt_percent: u16,
        owner_bridge_fee_wtdr_percent: u16
    ) -> ID;
    fn change_owner_amm_fee(ref self: T, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128,);
    fn change_owner_bridge_fee(
        ref self: T, bank_entity_id: ID, owner_bridge_fee_dpt_percent: u16, owner_bridge_fee_wtdr_percent: u16,
    );
}

#[dojo::contract]
mod bank_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use s0_eternum::models::bank::bank::{Bank};
    use s0_eternum::models::capacity::{CapacityCategory};
    use s0_eternum::models::config::{BankConfig, CapacityConfigCategory};
    use s0_eternum::models::owner::{Owner, EntityOwner};
    use s0_eternum::models::position::{Position, Coord};
    use s0_eternum::models::resources::{Resource, ResourceCustomImpl};
    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};

    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_bank(
            ref self: ContractState,
            realm_entity_id: ID,
            coord: Coord,
            owner_fee_num: u128,
            owner_fee_denom: u128,
            owner_bridge_fee_dpt_percent: u16,
            owner_bridge_fee_wtdr_percent: u16
        ) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank_entity_id: ID = world.dispatcher.uuid();

            //todo: check that tile is explored

            // ensure that the coord is not occupied by any other structure
            let structure_count: StructureCount = world.read_model(coord);
            structure_count.assert_none();

            // remove the resources from the realm
            let bank_config: BankConfig = world.read_model(WORLD_CONFIG_ID);
            let mut realm_resource: Resource = world.read_model((realm_entity_id, ResourceTypes::LORDS));

            realm_resource.burn(bank_config.lords_cost);
            realm_resource.save(ref world);

            world
                .write_model(
                    @Structure {
                        entity_id: bank_entity_id,
                        category: StructureCategory::Bank,
                        created_at: starknet::get_block_timestamp()
                    },
                );
            world.write_model(@StructureCount { coord, count: 1 },);
            world
                .write_model(
                    @CapacityCategory { entity_id: bank_entity_id, category: CapacityConfigCategory::Structure },
                );
            world
                .write_model(
                    @Bank {
                        entity_id: bank_entity_id,
                        owner_fee_num,
                        owner_fee_denom,
                        owner_bridge_fee_dpt_percent,
                        owner_bridge_fee_wtdr_percent,
                        exists: true
                    }
                );
            world.write_model(@Position { entity_id: bank_entity_id, x: coord.x, y: coord.y },);
            world.write_model(@Owner { entity_id: bank_entity_id, address: starknet::get_caller_address() });

            bank_entity_id
        }

        fn change_owner_amm_fee(
            ref self: ContractState, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let player = starknet::get_caller_address();

            let owner: Owner = world.read_model(bank_entity_id);
            assert(owner.address == player, 'Only owner can change fee');

            let mut bank: Bank = world.read_model(bank_entity_id);
            bank.owner_fee_num = new_owner_fee_num;
            bank.owner_fee_denom = new_owner_fee_denom;
            world.write_model(@bank);
        }


        fn change_owner_bridge_fee(
            ref self: ContractState,
            bank_entity_id: ID,
            owner_bridge_fee_dpt_percent: u16,
            owner_bridge_fee_wtdr_percent: u16
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let player = starknet::get_caller_address();

            let owner: Owner = world.read_model(bank_entity_id);
            assert(owner.address == player, 'Only owner can change fee');

            let mut bank: Bank = world.read_model(bank_entity_id);
            bank.owner_bridge_fee_dpt_percent = owner_bridge_fee_dpt_percent;
            bank.owner_bridge_fee_wtdr_percent = owner_bridge_fee_wtdr_percent;
            world.write_model(@bank);
        }
    }

    #[generate_trait]
    pub impl InternalBankSystemsImpl of BankSystemsTrait {
        fn pickup_resources_from_bank(
            ref world: WorldStorage, bank_entity_id: ID, entity_id: ID, resources: Span<(u8, u128)>,
        ) -> ID {
            let mut resources_clone = resources.clone();

            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        // add resources to recipient's balance
                        let mut recipient_resource = ResourceCustomImpl::get(
                            ref world, (bank_entity_id, resource_type)
                        );
                        recipient_resource.add(resource_amount);
                        recipient_resource.save(ref world);
                    },
                    Option::None => { break; }
                }
            };

            // then entity picks up the resources at the bank
            let (donkey_id, _, _) = InternalResourceSystemsImpl::transfer(
                ref world, bank_entity_id, entity_id, resources, entity_id, true, true
            );

            donkey_id
        }
    }
}
