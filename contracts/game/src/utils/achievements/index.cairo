use dojo::world::WorldStorage;
use achievement::store::{Store, StoreTrait};
use achievement::types::task::{Task as AchievementTask, TaskTrait as AchievementTaskTrait};

#[derive(Drop)]
pub struct Achievement {
    pub id: felt252, // Unique identifier for the achievement
    pub hidden: bool, // Hidden status of the achievement
    pub index: u8, // The page of the achievement in the group
    pub points: u16, // Weight of the achievement
    pub group: felt252, // Group name header to aggregate achievements
    pub icon: felt252, // https://fontawesome.com/search?o=r&s=solid
    pub title: felt252, // Title of the achievement
    pub description: ByteArray, // Description of the achievement (not the task itself)
    pub tasks: Span<AchievementTask> // Array of tasks to complete to unlock the achievement
}

pub mod Tasks {
    pub const SETTLEMENT: felt252 = 'SETTLEMENT';
    pub const EXPLORE: felt252 = 'EXPLORE';
}

#[generate_trait]
pub impl AchievementImpl of AchievementTrait {
    #[inline]
    fn declare(self: Achievement, mut world: WorldStorage) {
        let store: Store = StoreTrait::new(world);
        store
            .create(
                id: self.id,
                hidden: self.hidden,
                index: self.index,
                points: self.points,
                start: 0,
                end: 0,
                group: self.group,
                icon: self.icon,
                title: self.title,
                description: self.description.clone(),
                tasks: self.tasks,
                data: "",
            );
    }

    fn declare_all(mut world: WorldStorage) {
        let mut achievements: Array<Achievement> = array![
            Self::first_steps(),
            Self::cartographer_one(),
            Self::cartographer_two(),
            Self::cartographer_three(),
        ];
        while let Option::Some(achievement) = achievements.pop_front() {
            achievement.declare(world);
        }
    }


    fn progress(world: WorldStorage, player_id: felt252, task_id: felt252, count: u32, time: u64) {
        let store: Store = StoreTrait::new(world);
        store.progress(player_id: player_id, task_id: task_id, count: count, time: time)
    }

    #[inline]
    fn first_steps() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(
                id: Tasks::SETTLEMENT, total: 1, description: "Settle your first Realm.",
            ),
        ];
        Achievement {
            id: 'FIRST_STEPS',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Beginner',
            icon: 'fa-seedling',
            title: 'First steps',
            description: "Every journey begins with a single step",
            tasks: tasks.span(),
        }
    }

    #[inline]
    fn cartographer_one() -> Achievement {
        let task: AchievementTask = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 50, description: "Explore 50 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTROGRAPHER_ONE',
            hidden: false,
            index: 0,
            points: 20,
            group: 'Cartographer',
            icon: 'fa-mountain',
            title: 'Apprentice Cartographer',
            description: "The world is a book, and those who do not travel read only one page.",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn cartographer_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 250, description: "Explore 250 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTROGRAPHER_TWO',
            hidden: false,
            index: 1,
            points: 40,
            group: 'Cartographer',
            icon: 'fa-mountains',
            title: 'Experienced Cartographer',
            description: "The world is a book, and those who do not travel read only one page.",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn cartographer_three() -> Achievement {
        let task: AchievementTask = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 1000, description: "Explore 1000 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTROGRAPHER_THREE',
            hidden: false,
            index: 2,
            points: 80,
            group: 'Cartographer',
            icon: 'fa-mountain-sun',
            title: 'Experienced Cartographer',
            description: "The world is a book, and those who do not travel read only one page.",
            tasks: array![task].span(),
        }
    }
}
