// External imports

use bushido_trophy::types::task::{Task as BushidoTask, TaskTrait as BushidoTaskTrait};

// Internal imports

use eternum::utils::tasks;

// Types

#[derive(Copy, Drop)]
enum Task {
    None,
    Squire,
    Explorer,
    Battlelord,
    Conqueror,
    Breeder,
    Strategist,
    Opportunist,
    Ruler,
    Maximalist,
    Warlord,
}

// Implementations

#[generate_trait]
impl TaskImpl of TaskTrait {
    #[inline]
    fn identifier(self: Task) -> felt252 {
        match self {
            Task::None => 0,
            Task::Squire => tasks::squire::Squire::identifier(),
            Task::Explorer => tasks::explorer::Explorer::identifier(),
            Task::Battlelord => tasks::battlelord::Battlelord::identifier(),
            Task::Conqueror => tasks::conqueror::Conqueror::identifier(),
            Task::Breeder => tasks::breeder::Breeder::identifier(),
            Task::Strategist => tasks::strategist::Strategist::identifier(),
            Task::Opportunist => tasks::opportunist::Opportunist::identifier(),
            Task::Ruler => tasks::ruler::Ruler::identifier(),
            Task::Maximalist => tasks::maximalist::Maximalist::identifier(),
            Task::Warlord => tasks::warlord::Warlord::identifier(),
        }
    }

    #[inline]
    fn description(self: Task, difficulty: u8, count: u32) -> ByteArray {
        match self {
            Task::None => "",
            Task::Squire => tasks::squire::Squire::description(difficulty, count),
            Task::Explorer => tasks::explorer::Explorer::description(difficulty, count),
            Task::Battlelord => tasks::battlelord::Battlelord::description(difficulty, count),
            Task::Conqueror => tasks::conqueror::Conqueror::description(difficulty, count),
            Task::Breeder => tasks::breeder::Breeder::description(difficulty, count),
            Task::Strategist => tasks::strategist::Strategist::description(difficulty, count),
            Task::Opportunist => tasks::opportunist::Opportunist::description(difficulty, count),
            Task::Ruler => tasks::ruler::Ruler::description(difficulty, count),
            Task::Maximalist => tasks::maximalist::Maximalist::description(difficulty, count),
            Task::Warlord => tasks::warlord::Warlord::description(difficulty, count),
        }
    }

    #[inline]
    fn tasks(self: Task, difficulty: u8, count: u32) -> Span<BushidoTask> {
        let task_id: felt252 = self.identifier();
        let description: ByteArray = self.description(difficulty, count);
        array![BushidoTaskTrait::new(task_id, count, description)].span()
    }
}

impl IntoTaskU8 of core::Into<Task, u8> {
    #[inline]
    fn into(self: Task) -> u8 {
        match self {
            Task::None => 0,
            Task::Squire => 1,
            Task::Explorer => 2,
            Task::Battlelord => 3,
            Task::Conqueror => 4,
            Task::Breeder => 5,
            Task::Strategist => 6,
            Task::Opportunist => 7,
            Task::Ruler => 8,
            Task::Maximalist => 9,
            Task::Warlord => 10,
        }
    }
}

impl IntoU8Task of core::Into<u8, Task> {
    #[inline]
    fn into(self: u8) -> Task {
        let card: felt252 = self.into();
        match card {
            0 => Task::None,
            1 => Task::Squire,
            2 => Task::Explorer,
            3 => Task::Battlelord,
            4 => Task::Conqueror,
            5 => Task::Breeder,
            6 => Task::Strategist,
            7 => Task::Opportunist,
            8 => Task::Ruler,
            9 => Task::Maximalist,
            10 => Task::Warlord,
            _ => Task::None,
        }
    }
}

impl TaskPrint of core::debug::PrintTrait<Task> {
    #[inline]
    fn print(self: Task) {
        self.identifier().print();
    }
}

