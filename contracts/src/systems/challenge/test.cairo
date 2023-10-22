mod challenge_system_tests{
    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::systems::challenge::interface::{
        IChallengeSystemsDispatcher, 
        IChallengeSystemsDispatcherTrait
    };

    fn setup() -> (IWorldDispatcher, IChallengeSystemsDispatcher) {
        let world = spawn_eternum();

        let challenge_systems_address 
            = deploy_system(challenge_systems::TEST_CLASS_HASH);

        let challenge_systems_dispatcher = IChallengeSystemsDispatcher {
            contract_address: challenge_systems_address
        };

        (world, challenge_systems_dispatcher)
    }

    #[test]
    #[available_gas(30000000000000)]
    test_generate_infantry(){
        let (world, challenge_systems_dispatcher) = setup();
    }
}