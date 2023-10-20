// ---------------------------------------- contract --------------------------------------

#[dojo::contract]
mod cc {
    // events would be emitted twice
    // that should be solved when it is done
    // or change it in cc source code

    // ------------------------------------- import -------------------------------------

    use cc_starknet::{Dungeons, utils::pack::Pack};
    use Dungeons::{DungeonDojo, Name};
    use eternum::systems::cc_map::interface::CCInterface;
    use starknet::{get_caller_address, ContractAddress};
    use eternum::models::cc_map::Map;

    // ------------------------------------- event -------------------------------------

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ForTest: ForTest,
        Svg: Svg
    }

    #[derive(Drop, starknet::Event)]
    struct Svg {
        #[key]
        Topic: felt252,
        #[key]
        Index: u128,
        #[key]
        Content: felt252
    }

    #[derive(Drop, starknet::Event)]
    struct ForTest {
        #[key]
        One: u128,
        #[key]
        Two: u128,
        #[key]
        Three: u128,
        #[key]
        Param: felt252
    }

    // ------------------------------------- constructor --------------------------------

    #[constructor]
    fn constructor(ref self: ContractState) {
        let mut state = Dungeons::unsafe_new_contract_state();
        Dungeons::constructor(ref state);
    }

    // ------------------------------------- implement ----------------------------------

    fn get_world(self: @ContractState) -> IWorldDispatcher {
        self.world_dispatcher.read()
    }

    #[external(v0)]
    fn test(ref self: ContractState) {
        CCImpl::mint(ref self);

        CCImpl::generate(@self, 1);

        CCImpl::svg(@self, 1);

        let map: Map = get!(get_world(@self), 1, (Map));
        emit!(get_world(@self), ForTest { One: 1, Two: 2, Three: 3, Param: map.layout1 });
    }

    #[external(v0)]
    impl CCImpl of CCInterface<ContractState> {
        //
        fn mint(ref self: ContractState) {
            //
            let mut state = Dungeons::unsafe_new_contract_state();
            Dungeons::mint(ref state);
        //
        }

        fn generate(self: @ContractState, token_id: u256) {
            //
            let mut state = Dungeons::unsafe_new_contract_state();
            let dungeon = Dungeons::generate_dungeon_dojo(@state, token_id);

            let world = get_world(self);
            set!(
                world,
                Map {
                    token_id: token_id.try_into().unwrap(),
                    size: dungeon.size,
                    environment: dungeon.environment,
                    structure: dungeon.structure,
                    legendary: dungeon.legendary,
                    layout1: dungeon.layout.first,
                    layout2: dungeon.layout.second,
                    layout3: dungeon.layout.third,
                    doors1: dungeon.doors.first,
                    doors2: dungeon.doors.second,
                    doors3: dungeon.doors.third,
                    points1: dungeon.points.first,
                    points2: dungeon.points.second,
                    points3: dungeon.points.third,
                    affinity: dungeon.affinity,
                    dungeon_name1: dungeon.dungeon_name.first,
                    dungeon_name2: dungeon.dungeon_name.second,
                    dungeon_name3: dungeon.dungeon_name.third,
                    dungeon_name4: dungeon.dungeon_name.fourth,
                    dungeon_name5: dungeon.dungeon_name.fifth,
                    owner: Dungeons::ERC721Impl::owner_of(@state, token_id)
                }
            )
        //
        }

        fn svg(self: @ContractState, token_id: u256) {
            //
            let mut state = Dungeons::unsafe_new_contract_state();
            let mut svg = Dungeons::get_svg(@state, token_id);

            let world = get_world(self);
            let mut index = 0;
            let topic: felt252 = 'svg';
            loop {
                match svg.pop_front() {
                    Option::Some(part) => {
                        emit!(world, Svg { Topic: topic, Index: index, Content: part });
                        index += 1;
                    },
                    Option::None(_) => {
                        break;
                    }
                };
            }
        //
        }
    }
}
