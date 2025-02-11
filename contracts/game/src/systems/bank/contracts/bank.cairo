use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord};

#[starknet::interface]
trait IBankSystems<T> {
    fn change_owner_amm_fee(ref self: T, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128);
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
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use s1_eternum::models::bank::bank::{Bank};
    use s1_eternum::models::config::{BankConfig, CapacityCategory, WorldConfigUtilImpl};
    use s1_eternum::models::owner::{EntityOwner, Owner};
    use s1_eternum::models::position::{Coord, OccupiedBy, Occupier, OccupierTrait, Position};
    use s1_eternum::models::resource::resource::{Resource, ResourceImpl};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};

    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
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
            owner_bridge_fee_wtdr_percent: u16,
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
        fn create_bank(
            ref world: WorldStorage,
            realm_entity_id: ID,
            coord: Coord,
            owner_fee_num: u128,
            owner_fee_denom: u128,
            owner_bridge_fee_dpt_percent: u16,
            owner_bridge_fee_wtdr_percent: u16,
        ) -> ID {
            // SeasonImpl::assert_season_is_not_over(world);

            let bank_entity_id: ID = world.dispatcher.uuid();

            //todo: check that tile is explored

            // ensure that the coord is not occupied by any other structure
            let mut occupier: Occupier = world.read_model(coord);
            assert!(occupier.not_occupied(), "bank location is not empty");

            // remove the resources from the realm
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut realm_resource: Resource = world.read_model((realm_entity_id, ResourceTypes::LORDS));
            realm_resource.burn(bank_config.lords_cost);
            realm_resource.save(ref world);

            let owner: Owner = Owner { entity_id: bank_entity_id, address: starknet::get_caller_address() };
            let structure: Structure = StructureImpl::new(bank_entity_id, StructureCategory::Bank, coord, owner);
            world.write_model(@structure);

            occupier.entity = OccupiedBy::Structure(bank_entity_id);
            world.write_model(@occupier);

            world
                .write_model(
                    @Weight { entity_id: bank_entity_id, value: 0, capacity_category: CapacityCategory::Structure },
                );
            world
                .write_model(
                    @Bank {
                        entity_id: bank_entity_id,
                        owner_fee_num,
                        owner_fee_denom,
                        owner_bridge_fee_dpt_percent,
                        owner_bridge_fee_wtdr_percent,
                        exists: true,
                    },
                );

            bank_entity_id
        }

        fn pickup_resources_from_bank(
            ref world: WorldStorage, bank_entity_id: ID, entity_id: ID, resources: Span<(u8, u128)>,
        ) -> ID {
            let mut resources_clone = resources.clone();

            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount,
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        // add resources to recipient's balance
                        let mut recipient_resource = ResourceImpl::get(ref world, (bank_entity_id, resource_type));
                        recipient_resource.add(resource_amount);
                        recipient_resource.save(ref world);
                    },
                    Option::None => { break; },
                }
            };

            // then entity picks up the resources at the bank
            let (donkey_id, _, _) = InternalResourceSystemsImpl::transfer(
                ref world, bank_entity_id, entity_id, resources, entity_id, true, true,
            );

            donkey_id
        }
    }
}
