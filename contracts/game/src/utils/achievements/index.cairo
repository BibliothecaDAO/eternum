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
    pub const COMPLETE_ORDER: felt252 = 'COMPLETE_ORDER';
    pub const KILL_AGENT: felt252 = 'KILL_AGENT';
    pub const WIN_BATTLE: felt252 = 'WIN_BATTLE';
    pub const PRODUCE_T3: felt252 = 'PRODUCE_T3';
    pub const WIN_BIOME_BATTLE: felt252 = 'WIN_BIOME_BATTLE';
    pub const SUCCESSFUL_RAID: felt252 = 'SUCCESSFUL_RAID';
    pub const DEFEND_STRUCTURE: felt252 = 'DEFEND_STRUCTURE';
    pub const UPGRADE_REALM: felt252 = 'UPGRADE_REALM';
    pub const UPGRADE_VILLAGE: felt252 = 'UPGRADE_VILLAGE';
    pub const JOIN_TRIBE: felt252 = 'JOIN_TRIBE';
    pub const CONTRIBUTE_HYPERSTRUCTURE: felt252 = 'CONTRIBUTE_HYPERSTRUCTURE';
    pub const WIN_GAME: felt252 = 'WIN_GAME';
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
            Self::first_village(),
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
            Self::lord_of_logistics_one(),
            Self::lord_of_logistics_two(),
            Self::lord_of_logistics_three(),
            Self::blade_runner(),
            Self::nexus_six(),
            Self::first_blood(),
            Self::hardened_battler(),
            Self::seasoned_commander(),
            Self::tier_three_general(),
            Self::successful_raider(),
            Self::fortress(),
            Self::city_planner(),
            Self::kingdom_come(),
            Self::imperial_ambition(),
            Self::village_elder(),
            Self::tribal_chief(),
            Self::contributor_one(),
            Self::contributor_two(),
            Self::contributor_three(),
            Self::history_written_by_victor(),
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
    fn first_realm() -> Achievement {
        let tasks: Array<AchievementTask> = array![
            AchievementTaskTrait::new(id: Tasks::REALM_SETTLEMENT, total: 1, description: "Settle your first Realm."),
        ];
        Achievement {
            id: 'FIRST_REALM',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Explorer',
            icon: 'fa-seedling',
            title: 'Realm Settler',
            description: "Every journey begins with a single step",
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
            points: 10,
            group: 'Explorer',
            icon: 'fa-house',
            title: 'Village Founder',
            description: "From humble beginnings come great things",
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
            group: 'Explorer',
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
            group: 'Explorer',
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
            group: 'Explorer',
            icon: 'fa-mountain-sun',
            title: 'Master Cartographer',
            description: "The world is a book, and those who do not travel read only one page.",
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
            points: 100,
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
            points: 25,
            group: 'Explorer',
            icon: 'fa-user',
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
            points: 25,
            group: 'Explorer',
            icon: 'fa-scroll',
            title: 'Shady Dealer',
            description: "Every quest begins with a mysterious encounter",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn lost_and_found() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::MINE_DISCOVER, total: 1, description: "Discover a Fragment Mine.",
        );
        Achievement {
            id: 'LOST_AND_FOUND',
            hidden: false,
            index: 0,
            points: 25,
            group: 'Explorer',
            icon: 'fa-gem',
            title: 'Lost & Found',
            description: "Ancient treasures await those who seek them",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn ancient_discoverer() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::HYPERSTRUCTURE_DISCOVER, total: 1, description: "Discover a Hyperstructure Foundation.",
        );
        Achievement {
            id: 'ANCIENT_DISCOVERER',
            hidden: false,
            index: 0,
            points: 50,
            group: 'Explorer',
            icon: 'fa-landmark',
            title: 'Ancient Discoverer',
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
            points: 30,
            group: 'Tycoon',
            icon: 'fa-coins',
            title: 'Resource Tycoon I',
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
            points: 60,
            group: 'Tycoon',
            icon: 'fa-coins',
            title: 'Resource Tycoon II',
            description: "Wealth beyond measure",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn resource_tycoon_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::RESOURCE_PRODUCE, total: 1_000_000_000, description: "Produce 1,000,000,000 resources.",
        );
        Achievement {
            id: 'RESOURCE_TYCOON_THREE',
            hidden: false,
            index: 2,
            points: 120,
            group: 'Tycoon',
            icon: 'fa-coins',
            title: 'Resource Tycoon III',
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
            points: 20,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Master Builder I',
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
            points: 40,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Master Builder II',
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
            points: 80,
            group: 'Builder',
            icon: 'fa-building',
            title: 'Master Builder III',
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
            points: 15,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Chief Foreman I',
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
            points: 30,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Chief Foreman II',
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
            points: 60,
            group: 'Builder',
            icon: 'fa-hammer',
            title: 'Chief Foreman III',
            description: "Master of rapid construction",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 1_000_000, description: "Produce 1,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_ONE',
            hidden: false,
            index: 0,
            points: 20,
            group: 'Tycoon',
            icon: 'fa-person-digging',
            title: 'Labor Powerhouse I',
            description: "The strength of many working as one",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 10_000_000, description: "Produce 10,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_TWO',
            hidden: false,
            index: 1,
            points: 40,
            group: 'Tycoon',
            icon: 'fa-person-digging',
            title: 'Labor Powerhouse II',
            description: "A workforce to be reckoned with",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn labor_powerhouse_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::LABOR_PRODUCE, total: 100_000_000, description: "Produce 100,000,000 Labor.",
        );
        Achievement {
            id: 'LABOR_POWERHOUSE_THREE',
            hidden: false,
            index: 2,
            points: 80,
            group: 'Tycoon',
            icon: 'fa-person-digging',
            title: 'Labor Powerhouse III',
            description: "The power of industry unleashed",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn lord_of_logistics_one() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::COMPLETE_ORDER, total: 10, description: "Complete 10 Orders.");
        Achievement {
            id: 'LORD_OF_LOGISTICS_ONE',
            hidden: false,
            index: 0,
            points: 10,
            group: 'Trader',
            icon: 'fa-truck-fast',
            title: 'Lord of Logistics I',
            description: "The wheels of commerce turn smoothly",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn lord_of_logistics_two() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::COMPLETE_ORDER, total: 50, description: "Complete 50 Orders.");
        Achievement {
            id: 'LORD_OF_LOGISTICS_TWO',
            hidden: false,
            index: 1,
            points: 30,
            group: 'Trader',
            icon: 'fa-truck-fast',
            title: 'Lord of Logistics II',
            description: "A well-oiled machine of commerce",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn lord_of_logistics_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::COMPLETE_ORDER, total: 200, description: "Complete 200 Orders.",
        );
        Achievement {
            id: 'LORD_OF_LOGISTICS_THREE',
            hidden: false,
            index: 2,
            points: 80,
            group: 'Trader',
            icon: 'fa-truck-fast',
            title: 'Lord of Logistics III',
            description: "Master of the supply chain",
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
            points: 30,
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
            points: 60,
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
            points: 25,
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
            points: 50,
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
            points: 100,
            group: 'Warrior',
            icon: 'fa-flag',
            title: 'Seasoned Commander',
            description: "A leader forged in the fires of battle",
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
            points: 75,
            group: 'Warrior',
            icon: 'fa-chess-knight',
            title: 'Tier 3 General',
            description: "The elite forces are at your command",
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
    fn successful_raider() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::SUCCESSFUL_RAID,
            total: 10,
            description: "Successfully raid resources from an enemy structure 10 times.",
        );
        Achievement {
            id: 'SUCCESSFUL_RAIDER',
            hidden: false,
            index: 0,
            points: 50,
            group: 'Warrior',
            icon: 'fa-shield-halved',
            title: 'Successful Raider',
            description: "Take what you need, leave what you don't",
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
            points: 50,
            group: 'Warrior',
            icon: 'fa-fort-awesome',
            title: 'Fortress',
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
            points: 50,
            group: 'Progression',
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
            points: 100,
            group: 'Progression',
            icon: 'fa-crown',
            title: 'Kingdom Come',
            description: "A realm worthy of a king",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn imperial_ambition() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::UPGRADE_REALM, total: 1, description: "Upgrade a Realm to an Empire.",
        );
        Achievement {
            id: 'IMPERIAL_AMBITION',
            hidden: false,
            index: 2,
            points: 200,
            group: 'Progression',
            icon: 'fa-empire',
            title: 'Imperial Ambition',
            description: "The greatest of all realms",
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
            points: 75,
            group: 'Progression',
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
            points: 25,
            group: 'Social',
            icon: 'fa-users',
            title: 'Tribal Chief',
            description: "Strength in numbers",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_one() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 500_000,
            description: "Contribute 500,000 resources to a Hyperstructure.",
        );
        Achievement {
            id: 'CONTRIBUTOR_ONE',
            hidden: false,
            index: 0,
            points: 50,
            group: 'Social',
            icon: 'fa-hands-holding',
            title: 'Contributor I',
            description: "Every contribution matters",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_two() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 5_000_000,
            description: "Contribute 5,000,000 resources to a Hyperstructure.",
        );
        Achievement {
            id: 'CONTRIBUTOR_TWO',
            hidden: false,
            index: 1,
            points: 100,
            group: 'Social',
            icon: 'fa-hands-holding',
            title: 'Contributor II',
            description: "A significant contribution to history",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn contributor_three() -> Achievement {
        let task = AchievementTaskTrait::new(
            id: Tasks::CONTRIBUTE_HYPERSTRUCTURE,
            total: 50_000_000,
            description: "Contribute 50,000,000 resources to a Hyperstructure.",
        );
        Achievement {
            id: 'CONTRIBUTOR_THREE',
            hidden: false,
            index: 2,
            points: 200,
            group: 'Social',
            icon: 'fa-hands-holding',
            title: 'Contributor III',
            description: "A legendary contribution to the ages",
            tasks: array![task].span(),
        }
    }

    #[inline]
    fn history_written_by_victor() -> Achievement {
        let task = AchievementTaskTrait::new(id: Tasks::WIN_GAME, total: 1, description: "Win the game.");
        Achievement {
            id: 'THE_GREAT_VICTOR',
            hidden: false,
            index: 0,
            points: 1000,
            group: 'Victory',
            icon: 'fa-trophy',
            title: 'The Great Victor',
            description: "The greatest achievement of all, conquering the world.",
            tasks: array![task].span(),
        }
    }
}
