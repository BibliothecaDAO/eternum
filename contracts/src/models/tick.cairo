// TODO next milestone
use eternum::models::config::{WorldConfig, TickConfig, TickConfigTrait};
use eternum::constants::WORLD_CONFIG_ID;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};



#[derive(Model, Copy, Drop, Serde)]
struct TickMove {
    #[key]
    entity_id: u128, 
    tick: u64,
    count: u8
}


#[generate_trait]
impl TickMoveImpl of TickMoveTrait {
    fn add(ref self: TickMove, world: IWorldDispatcher, num: u8) {
        let tick_config: TickConfig = get!(world, WORLD_CONFIG_ID, TickConfig);
        
        // reset tick count if a future tick has occured
        
        if self.tick != tick_config.current() {
            self.count = 0;
        }

        // ensure entity moves within tick moves limit
        assert!(
            self.count + num <= tick_config.max_moves_per_tick ,
                "max moves per tick exceeded"
        );

        self.count += num;
        self.tick = tick_config.current();
        set!(world, (self));
    }

    /// Max out an entity's tick move
    fn max_out(ref self: TickMove, world: IWorldDispatcher) {
        let tick_config: TickConfig = get!(world, WORLD_CONFIG_ID, TickConfig);

        self.tick = tick_config.current();
        self.count = tick_config.max_moves_per_tick;

        set!(world, (self));
    }
}

