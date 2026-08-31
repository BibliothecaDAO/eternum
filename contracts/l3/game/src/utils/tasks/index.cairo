// External imports

use achievement::types::task::{Task as BushidoTask, TaskTrait as BushidoTaskTrait};

// Internal imports

use crate::utils::tasks;

// Types

#[derive(Copy, Drop)]
pub enum Task {
    None,
    Squire,
    Explorer,
    Battlelord,
    Conqueror,
    Breeder,
    Builder,
    Discoverer,
    Claimer,
    Opportunist,
    Ruler,
    Maximalist,
    Warlord,
}

// Implementations

#[generate_trait]
pub impl TaskImpl of TaskTrait {
    #[inline]
    fn identifier(self: Task) -> felt252 {
        match self {
            Task::None => 0,
            Task::Squire => tasks::squire::Squire::identifier(),
            Task::Explorer => tasks::explorer::Explorer::identifier(),
            Task::Battlelord => tasks::battlelord::Battlelord::identifier(),
            Task::Conqueror => tasks::conqueror::Conqueror::identifier(),
            Task::Breeder => tasks::breeder::Breeder::identifier(),
            Task::Builder => tasks::builder::Builder::identifier(),
            Task::Discoverer => tasks::discoverer::Discoverer::identifier(),
            Task::Claimer => tasks::claimer::Claimer::identifier(),
            Task::Opportunist => tasks::opportunist::Opportunist::identifier(),
            Task::Ruler => tasks::ruler::Ruler::identifier(),
            Task::Maximalist => tasks::maximalist::Maximalist::identifier(),
            Task::Warlord => tasks::warlord::Warlord::identifier(),
        }
    }

    #[inline]
    fn description(self: Task, count: u32) -> ByteArray {
        match self {
            Task::None => "",
            Task::Squire => tasks::squire::Squire::description(count),
            Task::Explorer => tasks::explorer::Explorer::description(count),
            Task::Battlelord => tasks::battlelord::Battlelord::description(count),
            Task::Conqueror => tasks::conqueror::Conqueror::description(count),
            Task::Breeder => tasks::breeder::Breeder::description(count),
            Task::Builder => tasks::builder::Builder::description(count),
            Task::Discoverer => tasks::discoverer::Discoverer::description(count),
            Task::Claimer => tasks::claimer::Claimer::description(count),
            Task::Opportunist => tasks::opportunist::Opportunist::description(count),
            Task::Ruler => tasks::ruler::Ruler::description(count),
            Task::Maximalist => tasks::maximalist::Maximalist::description(count),
            Task::Warlord => tasks::warlord::Warlord::description(count),
        }
    }

    #[inline]
    fn tasks(self: Task, count: u32) -> Span<BushidoTask> {
        let task_id: felt252 = self.identifier();
        let description: ByteArray = self.description(count);
        array![BushidoTaskTrait::new(task_id, count.into(), description)].span()
    }
}

impl IntoTaskU8 of core::traits::Into<Task, u8> {
    #[inline]
    fn into(self: Task) -> u8 {
        match self {
            Task::None => 0,
            Task::Squire => 1,
            Task::Explorer => 2,
            Task::Battlelord => 3,
            Task::Conqueror => 4,
            Task::Breeder => 5,
            Task::Builder => 6,
            Task::Discoverer => 7,
            Task::Claimer => 8,
            Task::Opportunist => 9,
            Task::Ruler => 10,
            Task::Maximalist => 11,
            Task::Warlord => 12,
        }
    }
}

impl IntoU8Task of core::traits::Into<u8, Task> {
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
            6 => Task::Builder,
            7 => Task::Discoverer,
            8 => Task::Claimer,
            9 => Task::Opportunist,
            10 => Task::Ruler,
            11 => Task::Maximalist,
            12 => Task::Warlord,
            _ => Task::None,
        }
    }
}
// impl TaskPrint of core::debug::PrintTrait<Task> {
//     #[inline]
//     fn print(self: Task) {
//         self.identifier().print();
//     }
// }


