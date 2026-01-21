use achievement::store::{Store, StoreTrait};
use achievement::types::task::{Task as AchievementTask, TaskTrait as AchievementTaskTrait};
use dojo::world::WorldStorage;

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
    pub const REALM_SETTLEMENT: felt252 = 'REALM_SETTLEMENT';
    pub const VILLAGE_SETTLEMENT: felt252 = 'VILLAGE_SETTLEMENT';
    pub const EXPLORE: felt252 = 'EXPLORE';
    pub const BIOME_DISCOVER: felt252 = 'BIOME_DISCOVER';
    pub const AGENT_DISCOVER: felt252 = 'AGENT_DISCOVER';
    pub const QUEST_DISCOVER: felt252 = 'QUEST_DISCOVER';
    pub const MINE_DISCOVER: felt252 = 'MINE_DISCOVER';
    pub const HYPERSTRUCTURE_DISCOVER: felt252 = 'HYPERSTRUCTURE_DISCOVER';
    pub const RESOURCE_PRODUCE: felt252 = 'RESOURCE_PRODUCE';
    pub const BUILD_STANDARD: felt252 = 'BUILD_STANDARD';
    pub const BUILD_SIMPLE: felt252 = 'BUILD_SIMPLE';
    pub const LABOR_PRODUCE: felt252 = 'LABOR_PRODUCE';
    pub const KILL_AGENT: felt252 = 'KILL_AGENT';
    pub const BRIDGE_LORDS: felt252 = 'BRIDGE_LORDS';
    pub const WIN_BATTLE: felt252 = 'WIN_BATTLE';
    pub const PRODUCE_T2: felt252 = 'PRODUCE_T2';
    pub const PRODUCE_T3: felt252 = 'PRODUCE_T3';
    pub const WIN_BIOME_BATTLE: felt252 = 'WIN_BIOME_BATTLE';
    pub const SUCCESSFUL_RAID: felt252 = 'SUCCESSFUL_RAID';
    pub const DEFEND_STRUCTURE: felt252 = 'DEFEND_STRUCTURE';
    pub const UPGRADE_REALM: felt252 = 'UPGRADE_REALM';
    pub const UPGRADE_VILLAGE: felt252 = 'UPGRADE_VILLAGE';
    pub const JOIN_TRIBE: felt252 = 'JOIN_TRIBE';
    pub const CONTRIBUTE_HYPERSTRUCTURE: felt252 = 'CONTRIBUTE_HYPERSTRUCTURE';
    pub const WIN_GAME: felt252 = 'WIN_GAME';
    pub const VICTORY_POINTS: felt252 = 'VICTORY_POINTS';
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
            Self::first_realm(),
            Self::third_realm(),
            Self::seventh_realm(),
            Self::first_village(),
            Self::third_village(),
            Self::fifth_village(),
            Self::cartographer_one(),
            Self::cartographer_two(),
            Self::cartographer_three(),
            Self::biome_master(),
            Self::chance_encounter(),
            Self::shady_dealer(),
            Self::lost_and_found(),
            Self::ancient_discoverer(),
            Self::resource_tycoon_one(),
            Self::resource_tycoon_two(),
            Self::resource_tycoon_three(),
            Self::master_builder_one(),
            Self::master_builder_two(),
            Self::master_builder_three(),
            Self::chief_foreman_one(),
            Self::chief_foreman_two(),
            Self::chief_foreman_three(),
            Self::labor_powerhouse_one(),
            Self::labor_powerhouse_two(),
            Self::labor_powerhouse_three(),
            Self::bridger_one(),
            Self::bridger_two(),
            Self::bridger_three(),
            Self::blade_runner(),
            Self::nexus_six(),
            Self::first_blood(),
            Self::hardened_battler(),
            Self::seasoned_commander(),
            Self::tier_two_general(),
            Self::tier_three_general(),
            Self::petty_raider(),
            Self::feared_raider(),
            Self::fortress(),
            Self::city_planner(),
            Self::kingdom_come(),
            Self::imperial_ambition(),
            Self::village_elder(),
            Self::tribal_chief(),
            Self::contributor_one(),
            Self::contributor_two(),
            Self::contributor_three(),
            Self::points_collector_one(),
            Self::points_collector_two(),
            Self::points_collector_three(),
            Self::history_written_by_victor(),
        ];
        while let Option::Some(achievement) = achievements.pop_front() {
            achievement.declare(world);
        }
    }


    fn progress(world: WorldStorage, player_id: felt252, task_id: felt252, count: u32, time: u64) {
        let store: Store = StoreTrait::new(world);
        store.progress(player_id: player_id, task_id: task_id, count: count.into(), time: time)
    }

    #[inline]
    fn first_realm() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::REALM_SETTLEMENT, total: 1, description: "Settle your first Realm."),
        ];
        Achievement {
            id: 'FIRST_REALM',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Sovereign',
            icon: 'fa-chess-king',
            title: 'The Lord',
            description: "Every journey begins with a single step",
            tasks: tasks.span(),
        }
    }

    fn third_realm() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::REALM_SETTLEMENT, total: 3, description: "Settle your 3rd Realm."),
        ];
        Achievement {
            id: 'THIRD_REALM',
            hidden: false,
            index: 1,
            points: 15,
            group: 'Sovereign',
            icon: 'fa-chess-king',
            title: 'The Duke',
            description: "The seeds of power take root across the land",
            tasks: tasks.span(),
        }
    }

    fn seventh_realm() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::REALM_SETTLEMENT, total: 7, description: "Settle your 7th Realm."),
        ];
        Achievement {
            id: 'SEVENTH_REALM',
            hidden: false,
            index: 2,
            points: 40,
            group: 'Sovereign',
            icon: 'fa-chess-king',
            title: 'The King',
            description: "An empire of grand ambition rises from your vision",
            tasks: tasks.span(),
        }
    }

    #[inline]
    fn first_village() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(
                id: Tasks::VILLAGE_SETTLEMENT, total: 1, description: "Settle your first Village",
            ),
        ];
        Achievement {
            id: 'FIRST_VILLAGE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Sovereign',
            icon: 'fa-house',
            title: 'The Serf',
            description: "From humble beginnings come great things",
            tasks: tasks.span(),
        }
    }

    #[inline]
    fn third_village() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::VILLAGE_SETTLEMENT, total: 3, description: "Settle your 3rd Village"),
        ];
        Achievement {
            id: 'THIRD_VILLAGE',
            hidden: false,
            index: 1,
            points: 10,
            group: 'Sovereign',
            icon: 'fa-house',
            title: 'The Citizen',
            description: "Communities flourish under your watchful eye",
            tasks: tasks.span(),
        }
    }

    fn fifth_village() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::VILLAGE_SETTLEMENT, total: 5, description: "Settle your 5th Village"),
        ];
        Achievement {
            id: 'FIFTH_VILLAGE',
            hidden: false,
            index: 2,
            points: 15,
            group: 'Sovereign',
            icon: 'fa-house',
            title: 'The Mayor',
            description: "Your network of villages spans the horizon",
            tasks: tasks.span(),
        }
    }

    #[inline]
    fn cartographer_one() -> Achievement {
        let task: AchievementTask = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 50, description: "Explore 50 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTOGRAPHER_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Explorer',
            icon: 'fa-mountain',
            title: 'Novice Explorer',
            description: "The world is a book, and those who do not travel read only one page.",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn cartographer_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 200, description: "Explore 200 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTOGRAPHER_TWO',
            hidden: false,
            index: 1,
            points: 20,
            group: 'Explorer',
            icon: 'fa-mountains',
            title: 'Journeyman Explorer',
            description: "The thrill of discovery drives you beyond known borders",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn cartographer_three() -> Achievement {
        let task: AchievementTask = AchievementTaskTrait::new(
            id: Tasks::EXPLORE, total: 500, description: "Explore 500 hexes on the World Map.",
        );
        Achievement {
            id: 'CARTOGRAPHER_THREE',
            hidden: false,
            index: 2,
            points: 50,
            group: 'Explorer',
            icon: 'fa-mountain-sun',
            title: 'Master Explorer',
            description: "No corner of the world remains hidden from your gaze",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn biome_master() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BIOME_DISCOVER, total: 16, description: "Discover all 16 biome types.",
        );
        Achievement {
            id: 'BIOME_MASTER',
            hidden: false,
            index: 0,
            points: 30,
            group: 'Explorer',
            icon: 'fa-earth-americas',
            title: 'Biome Master',
            description: "A true explorer knows every corner of the world",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn chance_encounter() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::AGENT_DISCOVER, total: 1, description: "Discover an Agent.");
        Achievement {
            id: 'CHANCE_ENCOUNTER',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Archaeologist',
            icon: 'fa-person',
            title: 'Chance Encounter',
            description: "The world is full of interesting characters",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn shady_dealer() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::QUEST_DISCOVER, total: 1, description: "Discover a Quest Tile.",
        );
        Achievement {
            id: 'SHADY_DEALER',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Archaeologist',
            icon: 'fa-hat-wizard',
            title: 'Shady Dealer',
            description: "Every quest begins with a mysterious encounter",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn ancient_discoverer() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::MINE_DISCOVER, total: 1, description: "Discover a Fragment Mine.",
        );
        Achievement {
            id: 'ANCIENT_DISCOVERER',
            hidden: false,
            index: 0,
            points: 15,
            group: 'Archaeologist',
            icon: 'fa-landmark',
            title: 'Fragment Finder',
            description: "Ancient treasures await those who seek them",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn lost_and_found() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::HYPERSTRUCTURE_DISCOVER, total: 1, description: "Discover a Hyperstructure Foundation.",
        );
        Achievement {
            id: 'LOST_AND_FOUND',
            hidden: false,
            index: 0,
            points: 80,
            group: 'Archaeologist',
            icon: 'fa-gem',
            title: 'Lost & Found',
            description: "The past holds the key to the future",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn resource_tycoon_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::RESOURCE_PRODUCE, total: 10_000_000, description: "Produce 10,000,000 resources.",
        );
        Achievement {
            id: 'RESOURCE_TYCOON_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Magnate',
            icon: 'fa-coins',
            title: 'Resource Producer',
            description: "The foundation of every great empire",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn resource_tycoon_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::RESOURCE_PRODUCE, total: 100_000_000, description: "Produce 100,000,000 resources.",
        );
        Achievement {
            id: 'RESOURCE_TYCOON_TWO',
            hidden: false,
            index: 1,
            points: 20,
            group: 'Magnate',
            icon: 'fa-coins',
            title: 'Resource Magnate',
            description: "Wealth beyond measure",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn resource_tycoon_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::RESOURCE_PRODUCE, total: 500_000_000, description: "Produce 500,000,000 resources.",
        );
        Achievement {
            id: 'RESOURCE_TYCOON_THREE',
            hidden: false,
            index: 2,
            points: 40,
            group: 'Magnate',
            icon: 'fa-coins',
            title: 'Resource Tycoon',
            description: "The wealth of nations",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn master_builder_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_STANDARD,
            total: 10,
            description: "Construct 10 buildings using the Standard construction mode.",
        );
        Achievement {
            id: 'MASTER_BUILDER_ONE',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Novice Builder',
            description: "Every great structure starts with a foundation",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn master_builder_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_STANDARD,
            total: 25,
            description: "Construct 25 buildings using the Standard construction mode.",
        );
        Achievement {
            id: 'MASTER_BUILDER_TWO',
            hidden: false,
            index: 1,
            points: 20,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Journeyman Builder',
            description: "A city rises from your vision",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn master_builder_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_STANDARD,
            total: 50,
            description: "Construct 50 buildings using the Standard construction mode.",
        );
        Achievement {
            id: 'MASTER_BUILDER_THREE',
            hidden: false,
            index: 2,
            points: 30,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Master Builder',
            description: "Architect of the future",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn chief_foreman_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_SIMPLE,
            total: 10,
            description: "Construct 10 buildings using the Simple construction mode.",
        );
        Achievement {
            id: 'CHIEF_FOREMAN_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Novice Foreman',
            description: "Efficiency is the key to success",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn chief_foreman_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_SIMPLE,
            total: 25,
            description: "Construct 25 buildings using the Simple construction mode.",
        );
        Achievement {
            id: 'CHIEF_FOREMAN_TWO',
            hidden: false,
            index: 1,
            points: 10,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Journeyman Foreman',
            description: "Speed and precision in perfect harmony",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn chief_foreman_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BUILD_SIMPLE,
            total: 50,
            description: "Construct 50 buildings using the Simple construction mode.",
        );
        Achievement {
            id: 'CHIEF_FOREMAN_THREE',
            hidden: false,
            index: 2,
            points: 20,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Master Foreman',
            description: "Master of rapid construction",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 5_000_000, description: "Produce 5,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Taskmaster',
            icon: 'fa-person-digging',
            title: 'Labor Producer',
            description: "The strength of many working as one",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 50_000_000, description: "Produce 50,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_TWO',
            hidden: false,
            index: 1,
            points: 20,
            group: 'Taskmaster',
            icon: 'fa-person-digging',
            title: 'Labor Magnate',
            description: "A workforce to be reckoned with",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 250_000_000, description: "Produce 250,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_THREE',
            hidden: false,
            index: 2,
            points: 40,
            group: 'Taskmaster',
            icon: 'fa-person-digging',
            title: 'Labor Tycoon',
            description: "The power of industry unleashed",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn bridger_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BRIDGE_LORDS, total: 200, description: "Bridge 200 $lords into the game",
        );
        Achievement {
            id: 'BRIDGER_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Portal',
            icon: 'fa-bridge',
            title: 'Dabbler',
            description: "First steps into a realm of wealth and influence",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn bridger_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BRIDGE_LORDS, total: 1000, description: "Bridge 1000 $lords into the game",
        );
        Achievement {
            id: 'BRIDGER_TWO',
            hidden: false,
            index: 1,
            points: 15,
            group: 'Portal',
            icon: 'fa-bridge',
            title: 'Cashed-up',
            description: "Your coffers fill as your ambitions grow",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn bridger_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::BRIDGE_LORDS, total: 4000, description: "Bridge 4000 $lords into the game",
        );
        Achievement {
            id: 'BRIDGER_THREE',
            hidden: false,
            index: 2,
            points: 30,
            group: 'Portal',
            icon: 'fa-bridge',
            title: 'Money Bags',
            description: "Legendary wealth that shapes the fate of kingdoms",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn blade_runner() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::KILL_AGENT, total: 1, description: "Kill an Agent.");
        Achievement {
            id: 'BLADE_RUNNER',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Warrior',
            icon: 'fa-khanda',
            title: 'Blade Runner',
            description: "The first step on a path of violence",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn nexus_six() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::KILL_AGENT, total: 10, description: "Kill 10 Agents.");
        Achievement {
            id: 'NEXUS_SIX',
            hidden: false,
            index: 1,
            points: 50,
            group: 'Warrior',
            icon: 'fa-khanda',
            title: 'Nexus-6',
            description: "A hunter of extraordinary skill",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn first_blood() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::WIN_BATTLE, total: 1, description: "Win your first battle.");
        Achievement {
            id: 'FIRST_BLOOD',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Warrior',
            icon: 'fa-flag',
            title: 'First Blood',
            description: "Victory tastes sweetest the first time",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn hardened_battler() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::WIN_BATTLE, total: 10, description: "Win 10 battles.");
        Achievement {
            id: 'HARDENED_BATTLER',
            hidden: false,
            index: 1,
            points: 15,
            group: 'Warrior',
            icon: 'fa-flag',
            title: 'Hardened Battler',
            description: "Experience is the best teacher",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn seasoned_commander() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::WIN_BATTLE, total: 25, description: "Win 25 battles.");
        Achievement {
            id: 'SEASONED_COMMANDER',
            hidden: false,
            index: 2,
            points: 30,
            group: 'Warrior',
            icon: 'fa-flag',
            title: 'Seasoned Commander',
            description: "A leader forged in the fires of battle",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn tier_two_general() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::PRODUCE_T2, total: 1, description: "Produce a T2 troop (Knight, Crossbowman, or Paladin).",
        );
        Achievement {
            id: 'TIER_TWO_GENERAL',
            hidden: false,
            index: 0,
            points: 20,
            group: 'Warrior',
            icon: 'fa-chess-knight',
            title: '2-Star General',
            description: "The elite forces are at your command",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn tier_three_general() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::PRODUCE_T3, total: 1, description: "Produce a T3 troop (Knight, Crossbowman, or Paladin).",
        );
        Achievement {
            id: 'TIER_THREE_GENERAL',
            hidden: false,
            index: 0,
            points: 40,
            group: 'Warrior',
            icon: 'fa-chess-knight',
            title: '3-Star General',
            description: "Legendary warriors march under your banner",
            tasks: array![task].span(),
        }
    }

    // #[inline]
    // fn biome_tactician() -> Achievement {
    //     let task = AchievementTaskTrait::new(
    //         id: Tasks::WIN_BIOME_BATTLE, total: 5, description: "Win a battle in 5 different biome types, utilizing
    //         biome advantages.",
    //     );
    //     Achievement {
    //         id: 'BIOME_TACTICIAN',
    //         hidden: false,
    //         index: 4,
    //         points: 100,
    //         group: 'Military',
    //         icon: 'fa-chess',
    //         title: 'Biome Tactician',
    //         description: "Master of terrain and tactics",
    //         tasks: array![task].span(),
    //     }
    // }

    #[inline]
    fn petty_raider() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::SUCCESSFUL_RAID, total: 1, description: "Successfully raid resources from an enemy structure.",
        );
        Achievement {
            id: 'PETTY_RAIDER',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Warrior',
            icon: 'fa-bolt',
            title: 'Petty Raider',
            description: "Take what you need, leave what you don't",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn feared_raider() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::SUCCESSFUL_RAID,
            total: 10,
            description: "Successfully raid resources from an enemy structure 10 times.",
        );
        Achievement {
            id: 'FEARED_RAIDER',
            hidden: false,
            index: 1,
            points: 20,
            group: 'Warrior',
            icon: 'fa-skull',
            title: 'Feared Raider',
            description: "A force to be reckoned with",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn fortress() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::DEFEND_STRUCTURE,
            total: 1,
            description: "Successfully defend your Realm or Village from an attack.",
        );
        Achievement {
            id: 'FORTRESS',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Warrior',
            icon: 'fa-skull-crossbones',
            title: 'Stalwart',
            description: "Your walls stand strong against all comers",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn city_planner() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::UPGRADE_REALM, total: 1, description: "Upgrade a Realm to a City.",
        );
        Achievement {
            id: 'CITY_PLANNER',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Imperial',
            icon: 'fa-city',
            title: 'City Planner',
            description: "From settlement to metropolis",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn kingdom_come() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::UPGRADE_REALM, total: 2, description: "Upgrade a Realm  to a Kingdom.",
        );
        Achievement {
            id: 'KINGDOM_COME',
            hidden: false,
            index: 1,
            points: 15,
            group: 'Imperial',
            icon: 'fa-crown',
            title: 'Kingdom Come',
            description: "A realm worthy of a king",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn imperial_ambition() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::UPGRADE_REALM, total: 3, description: "Upgrade a Realm to an Empire.",
        );
        Achievement {
            id: 'IMPERIAL_AMBITION',
            hidden: false,
            index: 2,
            points: 40,
            group: 'Imperial',
            icon: 'fa-landmark-flag',
            title: 'Imperial Ambition',
            description: "Your empire stands supreme, a landmark for all ages",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn village_elder() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::UPGRADE_VILLAGE, total: 1, description: "Upgrade a Village to a City.",
        );
        Achievement {
            id: 'VILLAGE_ELDER',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Imperial',
            icon: 'fa-house-circle-check',
            title: 'Village Elder',
            description: "From humble village to thriving city",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn tribal_chief() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::JOIN_TRIBE, total: 1, description: "Create or join a Tribe.");
        Achievement {
            id: 'TRIBAL_CHIEF',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Alliance',
            icon: 'fa-people-group',
            title: 'Socializer',
            description: "Strength in numbers",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 1_000_000,
            description: "Contribute 1,000,000 resources or labor to Hyperstructures.",
        );
        Achievement {
            id: 'CONTRIBUTOR_ONE',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Alliance',
            icon: 'fa-hands-holding',
            title: 'Hyperstructure Donator',
            description: "Every contribution matters",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 10_000_000,
            description: "Contribute 10,000,000 resources or labor to Hyperstructures.",
        );
        Achievement {
            id: 'CONTRIBUTOR_TWO',
            hidden: false,
            index: 1,
            points: 30,
            group: 'Alliance',
            icon: 'fa-hands-holding',
            title: 'Hyperstructure Contributor',
            description: "A significant contribution to history",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 50_000_000,
            description: "Contribute 50,000,000 resources or labor to  Hyperstructures.",
        );
        Achievement {
            id: 'CONTRIBUTOR_THREE',
            hidden: false,
            index: 2,
            points: 60,
            group: 'Alliance',
            icon: 'fa-hands-holding',
            title: 'Hyperstructure Developer',
            description: "A legendary contribution to the ages",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn points_collector_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::VICTORY_POINTS, total: 10_000, description: "Accumulate 10,000 Victory Points.",
        );
        Achievement {
            id: 'POINTS_COLLECTOR_ONE',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Dominion',
            icon: 'fa-star',
            title: 'On the Board',
            description: "Aiming for the moon",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn points_collector_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::VICTORY_POINTS, total: 100_000, description: "Accumulate 100,000 Victory Points.",
        );
        Achievement {
            id: 'POINTS_COLLECTOR_TWO',
            hidden: false,
            index: 1,
            points: 15,
            group: 'Dominion',
            icon: 'fa-stars',
            title: 'Contender',
            description: "Aiming for the stars",
            tasks: array![task].span(),
        }
    }


    #[inline]
    fn points_collector_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::VICTORY_POINTS, total: 500_000, description: "Accumulate 500,000 Victory Points.",
        );

        Achievement {
            id: 'POINTS_COLLECTOR_THREE',
            hidden: false,
            index: 2,
            points: 30,
            group: 'Dominion',
            icon: 'fa-ranking-star',
            title: 'Fierce Competitor',
            description: "Your achievements echo throughout the world",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn history_written_by_victor() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::WIN_GAME, total: 1, description: "Win the game.");
        Achievement {
            id: 'HISTORY_WRITTEN_BY_VICTOR',
            hidden: false,
            index: 0,
            points: 5,
            group: 'Dominion',
            icon: 'fa-trophy',
            title: 'Victorious',
            description: "The greatest achievement of all, conquering the world.",
            tasks: array![task].span(),
        }
    }
}
