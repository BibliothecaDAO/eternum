use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::{Coord};

#[dojo::interface]
trait IBankSystems {
    fn create_bank(
        ref world: IWorldDispatcher, realm_entity_id: ID, coord: Coord, owner_fee_num: u128, owner_fee_denom: u128,
    ) -> ID;
    fn change_owner_fee(
        ref world: IWorldDispatcher, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128,
    );
}

#[dojo::contract]
mod bank_systems {
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, ResourceTypes};
    use eternum::models::bank::bank::{Bank};
    use eternum::models::config::{BankConfig};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, Coord};
    use eternum::models::resources::{Resource, ResourceCustomImpl};
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};

    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn create_bank(
            ref world: IWorldDispatcher, realm_entity_id: ID, coord: Coord, owner_fee_num: u128, owner_fee_denom: u128,
        ) -> ID {
            let bank_entity_id: ID = world.uuid();

            //todo: check that tile is explored

            // ensure that the coord is not occupied by any other structure
            let structure_count: StructureCount = get!(world, coord, StructureCount);
            structure_count.assert_none();

            // remove the resources from the realm
            let bank_config = get!(world, WORLD_CONFIG_ID, BankConfig);

            let mut realm_resource = ResourceCustomImpl::get(world, (realm_entity_id, ResourceTypes::LORDS));

            realm_resource.burn(bank_config.lords_cost);
            realm_resource.save(world);

            set!(
                world,
                (
                    Structure {
                        entity_id: bank_entity_id,
                        category: StructureCategory::Bank,
                        created_at: starknet::get_block_timestamp()
                    },
                    StructureCount { coord, count: 1 },
                    Bank { entity_id: bank_entity_id, owner_fee_num, owner_fee_denom, exists: true },
                    Position { entity_id: bank_entity_id, x: coord.x, y: coord.y },
                    Owner { entity_id: bank_entity_id, address: starknet::get_caller_address() }
                )
            );

            bank_entity_id
        }

        fn change_owner_fee(
            ref world: IWorldDispatcher, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128,
        ) {
            let player = starknet::get_caller_address();

            let owner = get!(world, bank_entity_id, Owner);
            assert(owner.address == player, 'Only owner can change fee');

            let mut bank = get!(world, bank_entity_id, Bank);
            bank.owner_fee_num = new_owner_fee_num;
            bank.owner_fee_denom = new_owner_fee_denom;
            set!(world, (bank));
        }
    }

    #[generate_trait]
    pub impl InternalBankSystemsImpl of BankSystemsTrait {
        fn pickup_resources_from_bank(
            world: IWorldDispatcher, bank_entity_id: ID, entity_id: ID, resources: Span<(u8, u128)>,
        ) -> ID {
            let mut resources_clone = resources.clone();

            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        // add resources to recipient's balance
                        let mut recipient_resource = ResourceCustomImpl::get(world, (bank_entity_id, resource_type));
                        recipient_resource.add(resource_amount);
                        recipient_resource.save(world);
                    },
                    Option::None => { break; }
                }
            };

            // then entity picks up the resources at the bank
            let (donkey_id, _, _) = InternalResourceSystemsImpl::transfer(
                world, bank_entity_id, entity_id, resources, entity_id, true, true
            );

            donkey_id
        }
    }
}
