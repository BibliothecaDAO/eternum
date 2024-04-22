use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::{WorldConfig, TickConfig, TickTrait};

#[derive(Model, Copy, Drop, Serde)]
struct TickMove {
    #[key]
    entity_id: u128,
    tick: u64,
    count: u8
}

#[generate_trait]
impl TickMoveImpl of TickMoveTrait {
    fn get_config(ref self: TickMove, world: IWorldDispatcher) -> TickConfig {
        get!(world, WORLD_CONFIG_ID, TickConfig)
    }

    fn set(ref self: TickMove, world: IWorldDispatcher) {
        set!(world, (self));
    }

    fn add(ref self: TickMove, world: IWorldDispatcher, num: u8) {
        let tick_config: TickConfig = self.get_config(world);

        // reset tick count if a future tick has occured
        if self.tick != tick_config.current() {
            self.count = 0;
        }

        // ensure entity moves within tick moves limit
        assert!(self.count + num <= tick_config.max_moves_per_tick, "max moves per tick exceeded");

        self.count += num;
        self.tick = tick_config.current();
        self.set(world);
    }

    /// Max out an entity's tick move
    fn max_out(ref self: TickMove, world: IWorldDispatcher) {
        let tick_config: TickConfig = self.get_config(world);

        self.tick = tick_config.current();
        self.count = tick_config.max_moves_per_tick;
        self.set(world);
    }
}

