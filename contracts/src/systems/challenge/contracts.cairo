
#[dojo::contract]
mod challenge_systems{
    use eternum::alias::ID;
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use eternum::constants::ResourceTypes;
    use eternum::models::army::Army;
    use eternum::models::resources::Resource;
    use eternum::models::owner::Owner;
    use eternum::models::realm::{Realm, RealmTrait};
    use starknet::ContractAddress;
    use eternum::systems::challenge::interface::IChallengeSystems;
    use eternum::models::challenges::Challenges;

    #[external(v0)]
    impl ChallengeSystemsImpl of IChallengeSystems<ContractState> {
        fn generate_infantry(self: @ContractState, world: IWorldDispatcher, realm_id: u128, amount: u128){
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');
            //get resource
            let current_resource: Resource = get!(world, (realm_id, ResourceTypes::WHEAT), Resource);
            assert(current_resource.balance - amount >=0, 'not enough resource');

            //set resource
            set!(world, Resource {entity_id: realm_id, resource_type: ResourceTypes::WHEAT, balance: current_resource.balance - amount});

            // get army
            let current_army = get!(world, realm_id, Army);

            // set army
            set!(world, Army{
                entity_id:realm_id,
                infantry_qty:current_army.infantry_qty + amount,
                cavalry_qty:current_army.cavalry_qty,
                mage_qty:current_army.mage_qty,
            })
        }

        fn generate_cavalry(self: @ContractState, world: IWorldDispatcher, realm_id: u128, amount: u128){
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');
            //get resource
            let current_resource: Resource = get!(world, (realm_id, ResourceTypes::COPPER), Resource);
            assert(current_resource.balance - amount >=0, 'not enough resource');

            //set resource
            set!(world, Resource {entity_id: realm_id, resource_type: ResourceTypes::COPPER, balance: current_resource.balance - amount});

            // get army
            let current_army = get!(world, realm_id, Army);

            // set army
            set!(world, Army{
                entity_id:realm_id,
                infantry_qty:current_army.infantry_qty,
                cavalry_qty:current_army.cavalry_qty+amount,
                mage_qty:current_army.mage_qty,
            })
        }

        fn generate_mage(self: @ContractState, world: IWorldDispatcher, realm_id: u128, amount: u128){
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');
            //get resource
            let current_resource: Resource = get!(world, (realm_id, ResourceTypes::GOLD), Resource);
            assert(current_resource.balance - amount >=0, 'not enough resource');

            //set resource
            set!(world, Resource {entity_id: realm_id, resource_type: ResourceTypes::GOLD, balance: current_resource.balance - amount});

            // get army
            let current_army = get!(world, realm_id, Army);

            // set army
            set!(world, Army{
                entity_id:realm_id,
                infantry_qty:current_army.infantry_qty,
                cavalry_qty:current_army.cavalry_qty,
                mage_qty:current_army.mage_qty+amount,
            })
        }

        fn issue_challenge(
            self: @ContractState, 
            world: IWorldDispatcher, 
            realm_id: u128, 
            target_realm_id: u128,
            offer_resources_type: u8,
            offer_resources_amount: u128,
            target_resources_type: u8,
            target_resources_amount: u128
        ) -> ID{
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');

            //get my resource
            let current_resource: Resource = get!(world, (realm_id, offer_resources_type), Resource);
            assert(current_resource.balance - offer_resources_amount >=0, 'not enough resource');
            //get target resource
            let target_resource: Resource = get!(world, (target_realm_id, target_resources_type), Resource);
            assert(target_resource.balance - target_resources_amount >=0, 'not enough resource');

            //set chanllenge
            let challenge_id: ID = world.uuid().into();
            set!(world, Challenges{
                challenge_id: challenge_id,
                sender_id: realm_id,
                target_id: target_realm_id,
                offer_resources_type: offer_resources_type,
                offer_resources_amount: offer_resources_amount,
                target_resources_type: target_resources_type,
                target_resources_amount: target_resources_amount,
                state:0
            });
            return challenge_id;
        }

        fn accept_challenge(
            self: @ContractState, 
            world: IWorldDispatcher, 
            realm_id: u128, 
            challenge_id: u128
        ){
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');

            let challenge: Challenges = get!(world, challenge_id, Challenges);
            let sender_id = challenge.sender_id;
            let target_id = challenge.target_id;
            assert(target_id == realm_id, 'challenge not to player');

            let offer_resources_type = challenge.offer_resources_type;
            let offer_resources_amount = challenge.offer_resources_amount;
            let target_resources_type = challenge.target_resources_type;
            let target_resources_amount = challenge.target_resources_amount;

            let sender_resource: Resource = get!(world, (sender_id, offer_resources_type), Resource);
            assert(sender_resource.balance>=offer_resources_amount, 'sender not enough resource');

            let target_resource: Resource = get!(world, (target_id, target_resources_type), Resource);
            assert(target_resource.balance>=target_resources_amount, 'target not enough resource');
            let state = challenge.state;
            assert(state==0, 'challenge ended');

            let sender_army:Army = get!(world, sender_id, Army);
            let target_army:Army = get!(world, target_id, Army);
            let sender_power = sender_army.infantry_qty + sender_army.cavalry_qty*2 + sender_army.mage_qty*3;
            let target_power = target_army.infantry_qty + target_army.cavalry_qty*2 + target_army.mage_qty*3;
            let mut new_state: u8 = 0;
            if (sender_power>target_power){
                new_state = 2;
                set!(world, Resource{
                    entity_id: sender_id,
                    resource_type: target_resources_type,
                    balance: sender_resource.balance + target_resources_amount
                })
            }else if(sender_power<target_power){
                new_state = 3;
                set!(world, Resource{
                    entity_id: sender_id,
                    resource_type: offer_resources_type,
                    balance: target_resource.balance + offer_resources_amount
                })
            }else {
                new_state = 4;
            }

            set!(world, Challenges{
                challenge_id: challenge_id,
                sender_id: sender_id,
                target_id: target_id,
                offer_resources_type: offer_resources_type,
                offer_resources_amount: offer_resources_amount,
                target_resources_type: target_resources_type,
                target_resources_amount: target_resources_amount,
                state: new_state
            })
        }

        fn reject_challenge(
            self: @ContractState, 
            world: IWorldDispatcher, 
            realm_id: u128, 
            challenge_id: u128
        ){
            // assert owner of realm
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));
            assert(owner.address == player_id, 'Realm does not belong to player');

            let challenge: Challenges = get!(world, challenge_id, Challenges);
            let sender_id = challenge.sender_id;
            let target_id = challenge.target_id;
            assert(target_id == realm_id, 'challenge not to player');

            let state = challenge.state;
            assert(state==0, 'challenge ended');

            set!(world, Challenges{
                challenge_id: challenge_id,
                sender_id: sender_id,
                target_id: target_id,
                offer_resources_type: challenge.offer_resources_type,
                offer_resources_amount: challenge.offer_resources_amount,
                target_resources_type: challenge.target_resources_type,
                target_resources_amount: challenge.target_resources_amount,
                state: 1
            })
        }
    }
}