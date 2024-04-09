#[dojo::contract]
mod bank_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceTrait, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::weight::Weight;
    use eternum::models::config::WeightConfig;
    use eternum::models::bank::{Bank, BankAuction, BankAuctionTrait, BankSwapResourceCost};
    use eternum::models::position::{Coord, Position, PositionTrait};

    use eternum::systems::transport::contracts::caravan_systems::caravan_systems::{
        InternalCaravanSystemsImpl
    };
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};


    use eternum::utils::vrgda::{LinearVRGDA, LinearVRGDATrait};
    use eternum::systems::bank::interface::IBankSystems;
    use eternum::constants::WORLD_CONFIG_ID;

    use cubit::f128::types::fixed::{Fixed, FixedTrait};


    #[abi(embed_v0)]
    impl BankSystemsImpl of IBankSystems<ContractState> {
        fn swap(
            world: IWorldDispatcher,
            bank_id: u128,
            bank_swap_resource_cost_index: u8,
            entity_id: u128,
            bought_resource_type: u8,
            bought_resource_amount: u128
        ) {
            let bank = get!(world, bank_id, Bank);
            assert(bank.exists, 'bank does not exist');

            let caller_address = starknet::get_caller_address();

            InternalCaravanSystemsImpl::check_owner(world, entity_id, caller_address);
            InternalCaravanSystemsImpl::check_arrival_time(world, entity_id);
            InternalCaravanSystemsImpl::check_position(world, entity_id, bank_id);

            let mut bank_auction = get!(
                world, (bank_id, bought_resource_type, bank_swap_resource_cost_index), BankAuction
            );
            assert(bank_auction.per_time_unit != 0, 'auction not found');

            let mut bank_auction_vrgda = bank_auction.to_LinearVRGDA();
            let mut bank_auction_time_since_start_fixed = bank_auction.get_time_since_start_fixed();

            let swap_cost_resources = get!(
                world, (bought_resource_type, bank_swap_resource_cost_index), BankSwapResourceCost
            );

            let mut index = 0_usize;
            let mut swap_resources_weight = 0;

            loop {
                if index == swap_cost_resources.resource_cost_count {
                    break ();
                }

                let swap_cost_resource = get!(
                    world, (swap_cost_resources.resource_cost_id, index), ResourceCost
                );
                let swap_cost_resource_amount_fixed = FixedTrait::new_unscaled(
                    swap_cost_resource.amount, false
                );

                let mut total_resource_swap_cost_fixed = FixedTrait::new_unscaled(0, false);

                let mut bought_resource_amount_remaining = bought_resource_amount;

                loop {
                    if bought_resource_amount_remaining == 0 {
                        break;
                    }

                    let swap_cost_multiplier = bank_auction_vrgda
                        .get_vrgda_price(
                            bank_auction_time_since_start_fixed,
                            FixedTrait::new_unscaled(bank_auction.sold, false)
                        );

                    let mut bought_resource_count = bank_auction.price_update_interval
                        - (bank_auction.sold % bank_auction.price_update_interval);

                    if bought_resource_amount_remaining < bought_resource_count {
                        bought_resource_count = bought_resource_amount_remaining;
                    }

                    let mut resource_swap_cost = swap_cost_resource_amount_fixed
                        * swap_cost_multiplier
                        * FixedTrait::new_unscaled(bought_resource_count, false);

                    bought_resource_amount_remaining -= bought_resource_count;
                    bank_auction.sold += bought_resource_count;
                    total_resource_swap_cost_fixed += resource_swap_cost;
                };

                let total_resource_swap_cost: u128 = total_resource_swap_cost_fixed
                    .try_into()
                    .unwrap();

                // deduct total swap cost for the current
                // resource from entity's balance
                let mut current_resource: resource 
                    = ResourceImpl::get(world, (entity_id, swap_cost_resource.resource_type).into());
                assert(
                    current_resource.balance >= total_resource_swap_cost, 'not enough resources'
                );
                current_resource.balance -= total_resource_swap_cost;
                current_resource.save(world);

                // update swap resources weight
                let swap_resource_type_weight = get!(
                    world, (WORLD_CONFIG_ID, swap_cost_resource.resource_type), WeightConfig
                );
                swap_resources_weight += swap_resource_type_weight.weight_gram
                    * total_resource_swap_cost;

                // reset auction amount sold for next loop
                bank_auction.sold -= bought_resource_amount;

                // increment index
                index += 1;
            };

            // remove weight from entity
            let mut entity_weight = get!(world, entity_id, Weight);
            entity_weight.value -= swap_resources_weight;
            set!(world, (entity_weight));

            bank_auction.sold = bought_resource_amount;
            set!(world, (bank_auction));

            let bought_resource = array![(bought_resource_type, bought_resource_amount)].span();

            // bank mints the resources it will give to buyer
            InternalResourceSystemsImpl::mint(world, bank_id, bought_resource);

            // give the minted resource to the buyer
            InternalResourceSystemsImpl::transfer(world, bank_id, entity_id, bought_resource);

            return;
        }
    }
}
