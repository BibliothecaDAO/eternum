use achievement::types::task::Task as BushidoTask;
use crate::utils::trophies;

// Constants

pub const TROPHY_COUNT: u8 = 20;

// Typ

#[derive(Copy, Drop)]
pub enum Trophy {
    None,
    Squire,
    ExplorerI,
    ExplorerII,
    ExplorerIII,
    BattlelordI,
    BattlelordII,
    BattlelordIII,
    ConquerorI,
    ConquerorII,
    ConquerorIII,
    BreederI,
    BreederII,
    BreederIII,
    StrategistI,
    StrategistII,
    StrategistIII,
    Opportunist,
    Ruler,
    Maximalist,
    Warlord,
}

#[generate_trait]
pub impl TrophyImpl of TrophyTrait {
    #[inline]
    fn identifier(self: Trophy) -> felt252 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::identifier(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::identifier(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::identifier(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::identifier(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::identifier(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::identifier(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::identifier(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::identifier(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::identifier(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::identifier(2),
            Trophy::BreederI => trophies::breeder::Breeder::identifier(0),
            Trophy::BreederII => trophies::breeder::Breeder::identifier(1),
            Trophy::BreederIII => trophies::breeder::Breeder::identifier(2),
            Trophy::StrategistI => trophies::strategist::Strategist::identifier(0),
            Trophy::StrategistII => trophies::strategist::Strategist::identifier(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::identifier(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::identifier(0),
            Trophy::Ruler => trophies::ruler::Ruler::identifier(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::identifier(0),
            Trophy::Warlord => trophies::warlord::Warlord::identifier(0),
        }
    }

    #[inline]
    fn hidden(self: Trophy) -> bool {
        match self {
            Trophy::None => true,
            Trophy::Squire => trophies::squire::Squire::hidden(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::hidden(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::hidden(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::hidden(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::hidden(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::hidden(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::hidden(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::hidden(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::hidden(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::hidden(2),
            Trophy::BreederI => trophies::breeder::Breeder::hidden(0),
            Trophy::BreederII => trophies::breeder::Breeder::hidden(1),
            Trophy::BreederIII => trophies::breeder::Breeder::hidden(2),
            Trophy::StrategistI => trophies::strategist::Strategist::hidden(0),
            Trophy::StrategistII => trophies::strategist::Strategist::hidden(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::hidden(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::hidden(0),
            Trophy::Ruler => trophies::ruler::Ruler::hidden(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::hidden(0),
            Trophy::Warlord => trophies::warlord::Warlord::hidden(0),
        }
    }

    #[inline]
    fn index(self: Trophy) -> u8 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::index(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::index(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::index(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::index(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::index(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::index(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::index(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::index(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::index(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::index(2),
            Trophy::BreederI => trophies::breeder::Breeder::index(0),
            Trophy::BreederII => trophies::breeder::Breeder::index(1),
            Trophy::BreederIII => trophies::breeder::Breeder::index(2),
            Trophy::StrategistI => trophies::strategist::Strategist::index(0),
            Trophy::StrategistII => trophies::strategist::Strategist::index(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::index(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::index(0),
            Trophy::Ruler => trophies::ruler::Ruler::index(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::index(0),
            Trophy::Warlord => trophies::warlord::Warlord::index(0),
        }
    }

    #[inline]
    fn points(self: Trophy) -> u16 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::points(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::points(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::points(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::points(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::points(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::points(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::points(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::points(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::points(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::points(2),
            Trophy::BreederI => trophies::breeder::Breeder::points(0),
            Trophy::BreederII => trophies::breeder::Breeder::points(1),
            Trophy::BreederIII => trophies::breeder::Breeder::points(2),
            Trophy::StrategistI => trophies::strategist::Strategist::points(0),
            Trophy::StrategistII => trophies::strategist::Strategist::points(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::points(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::points(0),
            Trophy::Ruler => trophies::ruler::Ruler::points(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::points(0),
            Trophy::Warlord => trophies::warlord::Warlord::points(0),
        }
    }

    #[inline]
    fn group(self: Trophy) -> felt252 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::group(),
            Trophy::ExplorerI => trophies::explorer::Explorer::group(),
            Trophy::ExplorerII => trophies::explorer::Explorer::group(),
            Trophy::ExplorerIII => trophies::explorer::Explorer::group(),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::group(),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::group(),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::group(),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::group(),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::group(),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::group(),
            Trophy::BreederI => trophies::breeder::Breeder::group(),
            Trophy::BreederII => trophies::breeder::Breeder::group(),
            Trophy::BreederIII => trophies::breeder::Breeder::group(),
            Trophy::StrategistI => trophies::strategist::Strategist::group(),
            Trophy::StrategistII => trophies::strategist::Strategist::group(),
            Trophy::StrategistIII => trophies::strategist::Strategist::group(),
            Trophy::Opportunist => trophies::opportunist::Opportunist::group(),
            Trophy::Ruler => trophies::ruler::Ruler::group(),
            Trophy::Maximalist => trophies::maximalist::Maximalist::group(),
            Trophy::Warlord => trophies::warlord::Warlord::group(),
        }
    }

    #[inline]
    fn icon(self: Trophy) -> felt252 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::icon(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::icon(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::icon(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::icon(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::icon(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::icon(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::icon(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::icon(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::icon(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::icon(2),
            Trophy::BreederI => trophies::breeder::Breeder::icon(0),
            Trophy::BreederII => trophies::breeder::Breeder::icon(1),
            Trophy::BreederIII => trophies::breeder::Breeder::icon(2),
            Trophy::StrategistI => trophies::strategist::Strategist::icon(0),
            Trophy::StrategistII => trophies::strategist::Strategist::icon(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::icon(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::icon(0),
            Trophy::Ruler => trophies::ruler::Ruler::icon(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::icon(0),
            Trophy::Warlord => trophies::warlord::Warlord::icon(0),
        }
    }

    #[inline]
    fn title(self: Trophy) -> felt252 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => trophies::squire::Squire::title(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::title(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::title(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::title(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::title(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::title(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::title(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::title(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::title(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::title(2),
            Trophy::BreederI => trophies::breeder::Breeder::title(0),
            Trophy::BreederII => trophies::breeder::Breeder::title(1),
            Trophy::BreederIII => trophies::breeder::Breeder::title(2),
            Trophy::StrategistI => trophies::strategist::Strategist::title(0),
            Trophy::StrategistII => trophies::strategist::Strategist::title(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::title(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::title(0),
            Trophy::Ruler => trophies::ruler::Ruler::title(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::title(0),
            Trophy::Warlord => trophies::warlord::Warlord::title(0),
        }
    }

    #[inline]
    fn description(self: Trophy) -> ByteArray {
        match self {
            Trophy::None => "",
            Trophy::Squire => trophies::squire::Squire::description(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::description(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::description(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::description(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::description(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::description(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::description(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::description(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::description(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::description(2),
            Trophy::BreederI => trophies::breeder::Breeder::description(0),
            Trophy::BreederII => trophies::breeder::Breeder::description(1),
            Trophy::BreederIII => trophies::breeder::Breeder::description(2),
            Trophy::StrategistI => trophies::strategist::Strategist::description(0),
            Trophy::StrategistII => trophies::strategist::Strategist::description(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::description(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::description(0),
            Trophy::Ruler => trophies::ruler::Ruler::description(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::description(0),
            Trophy::Warlord => trophies::warlord::Warlord::description(0),
        }
    }

    #[inline]
    fn tasks(self: Trophy) -> Span<BushidoTask> {
        match self {
            Trophy::None => [].span(),
            Trophy::Squire => trophies::squire::Squire::tasks(0),
            Trophy::ExplorerI => trophies::explorer::Explorer::tasks(0),
            Trophy::ExplorerII => trophies::explorer::Explorer::tasks(1),
            Trophy::ExplorerIII => trophies::explorer::Explorer::tasks(2),
            Trophy::BattlelordI => trophies::battlelord::Battlelord::tasks(0),
            Trophy::BattlelordII => trophies::battlelord::Battlelord::tasks(1),
            Trophy::BattlelordIII => trophies::battlelord::Battlelord::tasks(2),
            Trophy::ConquerorI => trophies::conqueror::Conqueror::tasks(0),
            Trophy::ConquerorII => trophies::conqueror::Conqueror::tasks(1),
            Trophy::ConquerorIII => trophies::conqueror::Conqueror::tasks(2),
            Trophy::BreederI => trophies::breeder::Breeder::tasks(0),
            Trophy::BreederII => trophies::breeder::Breeder::tasks(1),
            Trophy::BreederIII => trophies::breeder::Breeder::tasks(2),
            Trophy::StrategistI => trophies::strategist::Strategist::tasks(0),
            Trophy::StrategistII => trophies::strategist::Strategist::tasks(1),
            Trophy::StrategistIII => trophies::strategist::Strategist::tasks(2),
            Trophy::Opportunist => trophies::opportunist::Opportunist::tasks(0),
            Trophy::Ruler => trophies::ruler::Ruler::tasks(0),
            Trophy::Maximalist => trophies::maximalist::Maximalist::tasks(0),
            Trophy::Warlord => trophies::warlord::Warlord::tasks(0),
        }
    }

    #[inline]
    fn data(self: Trophy) -> ByteArray {
        ""
    }
}

pub impl IntoTrophyU8 of core::traits::Into<Trophy, u8> {
    #[inline]
    fn into(self: Trophy) -> u8 {
        match self {
            Trophy::None => 0,
            Trophy::Squire => 1,
            Trophy::ExplorerI => 2,
            Trophy::ExplorerII => 3,
            Trophy::ExplorerIII => 4,
            Trophy::BattlelordI => 5,
            Trophy::BattlelordII => 6,
            Trophy::BattlelordIII => 7,
            Trophy::ConquerorI => 8,
            Trophy::ConquerorII => 9,
            Trophy::ConquerorIII => 10,
            Trophy::BreederI => 11,
            Trophy::BreederII => 12,
            Trophy::BreederIII => 13,
            Trophy::StrategistI => 14,
            Trophy::StrategistII => 15,
            Trophy::StrategistIII => 16,
            Trophy::Opportunist => 17,
            Trophy::Ruler => 18,
            Trophy::Maximalist => 19,
            Trophy::Warlord => 20,
        }
    }
}

pub impl IntoU8Trophy of core::traits::Into<u8, Trophy> {
    #[inline]
    fn into(self: u8) -> Trophy {
        let card: felt252 = self.into();
        match card {
            0 => Trophy::None,
            1 => Trophy::Squire,
            2 => Trophy::ExplorerI,
            3 => Trophy::ExplorerII,
            4 => Trophy::ExplorerIII,
            5 => Trophy::BattlelordI,
            6 => Trophy::BattlelordII,
            7 => Trophy::BattlelordIII,
            8 => Trophy::ConquerorI,
            9 => Trophy::ConquerorII,
            10 => Trophy::ConquerorIII,
            11 => Trophy::BreederI,
            12 => Trophy::BreederII,
            13 => Trophy::BreederIII,
            14 => Trophy::StrategistI,
            15 => Trophy::StrategistII,
            16 => Trophy::StrategistIII,
            17 => Trophy::Opportunist,
            18 => Trophy::Ruler,
            19 => Trophy::Maximalist,
            20 => Trophy::Warlord,
            _ => Trophy::None,
        }
    }
}
// pub impl TrophyPrint of core::debug::PrintTrait<Trophy> {
//     #[inline]
//     fn print(self: Trophy) {
//         self.identifier().print();
//     }
// }


