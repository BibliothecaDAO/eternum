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
    use s1_eternum::models::config::{BankConfig, WorldConfigUtilImpl};
    use s1_eternum::models::owner::{EntityOwner, Owner, OwnerAddressTrait};
    use s1_eternum::models::position::{Coord, OccupiedBy, Occupier, OccupierTrait, Position};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
    use s1_eternum::models::structure::{StructureTrait};
    use s1_eternum::models::troop::{ExplorerTroops};
    use s1_eternum::models::weight::{Weight, WeightTrait};
    use s1_eternum::systems::utils::resource::{iResourceTransferImpl};
    use s1_eternum::systems::utils::structure::{iStructureImpl};


    use traits::Into;

    #[abi(embed_v0)]
    impl BankSystemsImpl of super::IBankSystems<ContractState> {
        fn change_owner_amm_fee(
            ref self: ContractState, bank_entity_id: ID, new_owner_fee_num: u128, new_owner_fee_denom: u128,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let bank_structure: Structure = world.read_model(bank_entity_id);
            bank_structure.owner.assert_caller_owner();

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

            let bank_structure: Structure = world.read_model(bank_entity_id);
            bank_structure.owner.assert_caller_owner();

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

            // ensure that the coord is not occupied by any other structure
            let mut occupier: Occupier = world.read_model(coord);
            assert!(occupier.not_occupied(), "bank location is not empty");

            // remove the resources from the realm
            let bank_config: BankConfig = WorldConfigUtilImpl::get_member(world, selector!("bank_config"));
            let mut player_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
            let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
            let mut player_lords_resource = SingleResourceStoreImpl::retrieve(
                ref world, realm_entity_id, ResourceTypes::LORDS, ref player_structure_weight, lords_weight_grams, true,
            );
            player_lords_resource.spend(bank_config.lords_cost, ref player_structure_weight, lords_weight_grams);
            player_lords_resource.store(ref world);

            // create the bank structure
            iStructureImpl::create(
                ref world, coord, starknet::get_caller_address(), bank_entity_id, StructureCategory::Bank, false,
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
    }
}
